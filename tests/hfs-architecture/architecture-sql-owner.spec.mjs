import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings, databaseFiles, entityFiles } from '../helpers/hfs-arch-be-fixture.mjs';
import { analyzeSql, tokenizeSql } from '../../scripts/hfs/architecture/sql-tokens.mjs';

// R86 sql-owner (BE_SQL_TABLE_OWNER): the SQL of `<name>.sql.ts` writes only its own capability's tables, reads only tables of
// owners it may import, names only tables an entity declares, and bounds every multi-row SELECT.

const UNIQUE = { purchases: [['id']], users: [['id'], ['email']] };
const analyze = text => analyzeSql(text, { uniqueSetsOf: table => UNIQUE[table] ?? null });
const tables = list => list.map(item => item.table).sort();

test('tokenizer: comments, strings, dollar quotes and quoted identifiers never look like tables', () => {
  const result = analyze(`-- FROM ghosts
    SELECT id, 'FROM strings' AS note, $$ JOIN dollar $$ AS d FROM /* JOIN block */ "purchases" WHERE id = $1`);
  assert.deepEqual(tables(result.reads), ['purchases']);
  assert.deepEqual(result.writes, []);
  assert.equal(tokenizeSql("SELECT 'it''s' FROM t").filter(token => token.t === 'string').length, 1);
});

test('tokenizer: writes and reads of every statement form, CTEs excluded from reads', () => {
  const result = analyze(`
    INSERT INTO purchases (id) SELECT id FROM users, ghosts g;
    UPDATE ONLY purchases SET status = 'x' FROM users u WHERE purchases.id = u.id;
    DELETE FROM purchases USING users WHERE 1 = 1;
    MERGE INTO purchases p USING users u ON p.id = u.id WHEN MATCHED THEN UPDATE SET status = 'y';
    WITH open AS (SELECT id FROM purchases WHERE id = $1) SELECT o.id FROM open o JOIN users ON users.id = o.id WHERE users.id = $2;
    SELECT id FROM purchases WHERE id = $1 FOR UPDATE;
    INSERT INTO users (id) VALUES ($1) ON CONFLICT (id) DO UPDATE SET id = $1;
    SELECT extract(year FROM created_at) FROM public.purchases p WHERE p.id = $1 AND a IS DISTINCT FROM b`);
  assert.deepEqual(tables(result.writes), ['purchases', 'purchases', 'purchases', 'purchases', 'users']);
  assert.deepEqual(tables(result.reads), ['ghosts', 'purchases', 'purchases', 'purchases', 'users', 'users', 'users', 'users', 'users']);
});

test('tokenizer: a substitution in a table position is dynamic, functions and subqueries are not tables', () => {
  const result = analyze('SELECT id FROM  WHERE id = $1; SELECT * FROM unnest($1::int[]) AS t LIMIT 5; SELECT x FROM (SELECT id x FROM purchases WHERE id = $1) s LIMIT 1');
  assert.equal(result.dynamic, 1);
  assert.deepEqual(tables(result.reads), ['purchases']);
});

test('tokenizer: a SELECT is bounded by LIMIT, a full unique key, aggregates alone, or having no FROM; anything else is not', () => {
  const bound = text => analyze(text).selects.map(item => item.bounded);
  assert.deepEqual(bound('SELECT id FROM purchases WHERE id = $1'), [true]);
  assert.deepEqual(bound('SELECT id FROM purchases p WHERE p.id = $1 AND status = $2'), [true]);
  assert.deepEqual(bound('SELECT id FROM users WHERE email = $1'), [true]);
  assert.deepEqual(bound('SELECT id FROM purchases LIMIT $1'), [true]);
  assert.deepEqual(bound('SELECT count(*), max(created_at) FROM purchases'), [true]);
  assert.deepEqual(bound('SELECT coalesce(sum(total), 0) AS total FROM purchases'), [true]);
  assert.deepEqual(bound('SELECT now()'), [true]);
  assert.deepEqual(bound('SELECT id FROM purchases'), [false]);
  assert.deepEqual(bound('SELECT id FROM purchases WHERE status = $1'), [false]);
  assert.deepEqual(bound('SELECT id FROM purchases WHERE id = ANY($1)'), [false]);
  assert.deepEqual(bound('SELECT id FROM purchases WHERE id = $1 OR status = $2'), [false]);
  assert.deepEqual(bound('SELECT status, count(*) FROM purchases GROUP BY status'), [false]);
  assert.deepEqual(bound('SELECT count(*) OVER () FROM purchases'), [false]);
  assert.deepEqual(bound('SELECT id FROM ghosts WHERE id = $1'), [false]);
  assert.deepEqual(bound('INSERT INTO purchases (id) VALUES ($1); UPDATE purchases SET status = $2 WHERE status = $3'), []);
});

const capability = (name, tier = 'domain') => `src/modules/${tier}/${name}`;

test('BE: bounded reads, own writes and reads of an importable owner raise nothing', t => {
  const root = archFixture(t, {
    files: {
      ...databaseFiles,
      ...entityFiles('purchase', 'purchases', "  @Column({ name: 'learner_id', type: 'uuid' }) learnerId!: string;\n"),
      ...entityFiles('identity', 'users', "  @Column({ name: 'email', type: 'varchar', unique: true }) email!: string;\n"),
      [`${capability('purchase')}/persistence/purchase.sql.ts`]: `import { sql } from '../../../platform/database';
/** one purchase */
export const FIND_ONE = sql\`SELECT id FROM purchases WHERE id = $1\`;
export const FIND_OPEN = sql\`SELECT id, learner_id FROM purchases WHERE learner_id = $1 AND status = 'FROM ghosts' LIMIT $2\`;
export const COUNT_ALL = sql\`SELECT count(*) FROM purchases\`;
export const MARK = sql\`UPDATE purchases SET status = $2 FROM users u WHERE purchases.learner_id = u.id AND u.email = $1\`;
export const BY_EMAIL = sql\`SELECT u.id FROM users u WHERE u.email = $1\`;
export const LOCK = sql\`SELECT id FROM purchases WHERE id = $1 FOR UPDATE\`;
export const dynamic = (column: string) => sql\`SELECT id FROM purchases WHERE id = $1 ORDER BY \${column} LIMIT 1\`;
`,
    },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'BE_SQL_TABLE_OWNER'), []);
  assert.equal(report.coverage.hfsMachine.sqlOwner.status, 'checked');
  assert.equal(report.coverage.hfsMachine.sqlOwner.entities, 2);
  assert.equal(report.coverage.hfsMachine.sqlOwner.templates, 7);
  assert.ok(report.coverage.checkedRuleIds.includes('BE_SQL_TABLE_OWNER'));
});

test('BE: a write to another owner, an unknown table, an unbounded SELECT and a platform reading a domain are each a finding', t => {
  const root = archFixture(t, {
    files: {
      ...databaseFiles,
      ...entityFiles('purchase', 'purchases'),
      ...entityFiles('identity', 'users'),
      [`${capability('purchase')}/persistence/purchase.sql.ts`]: `import { sql } from '../../../platform/database';
export const STEAL = sql\`UPDATE users SET id = $1 WHERE id = $2\`;
export const GHOST = sql\`SELECT id FROM ghosts WHERE id = $1\`;
export const ALL = sql\`SELECT id FROM purchases WHERE status = $1\`;
export const JOINED = sql\`INSERT INTO purchases (id) SELECT u.id FROM users u JOIN ghost_links l ON l.id = u.id LIMIT 5\`;
`,
      [`${capability('inbox', 'platform')}/index.ts`]: 'export const inbox = 1;\n',
      [`${capability('inbox', 'platform')}/persistence/inbox.sql.ts`]: `import { sql } from '../../database';
export const PEEK = sql\`SELECT id FROM purchases WHERE id = $1\`;
`,
    },
  });
  const hits = findings(runArch(root), 'BE_SQL_TABLE_OWNER');
  const by = text => hits.filter(item => item.message.includes(text));
  assert.equal(by('writes table users').length, 1, JSON.stringify(hits, null, 1));
  assert.equal(by('ghosts').length, 1);
  assert.equal(by('ghost_links').length, 1);
  assert.equal(by('SELECT on purchases has no LIMIT').length, 1);
  const platform = hits.filter(item => item.path === 'src/modules/platform/inbox/persistence/inbox.sql.ts');
  assert.equal(platform.length, 1);
  assert.match(platform[0].message, /reads table purchases/);
  assert.equal(platform[0].reason, 'tierDirection');
  assert.equal(hits.length, 5, JSON.stringify(hits.map(item => item.message), null, 1));
});

test('BE: SQL outside a persistence `.sql.ts`, or with a tag not declared in platform/database, is not read', t => {
  const root = archFixture(t, {
    files: {
      ...databaseFiles,
      ...entityFiles('purchase', 'purchases'),
      'src/modules/domain/purchase/other.ts': "import { sql } from '../../platform/database';\nexport const BAD = sql`SELECT id FROM ghosts`;\n",
      'src/modules/domain/purchase/persistence/tagged.sql.ts': 'const sql = (s: TemplateStringsArray) => s.join(""); export const BAD = sql`SELECT id FROM ghosts`;\n',
    },
  });
  const report = runArch(root);
  assert.deepEqual(findings(report, 'BE_SQL_TABLE_OWNER'), []);
  assert.equal(report.coverage.hfsMachine.sqlOwner.foreignTags, 1);
});
