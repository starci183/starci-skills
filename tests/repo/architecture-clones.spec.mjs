import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, findings, runArch, ts } from '../helpers/hfs-arch-fixture.mjs';
import { checkClones, tokenize } from '../../scripts/hfs/architecture/clones.mjs';
import { canonCloneNodes } from '../../scripts/hfs/architecture/canon-clones.mjs';

// HFS check 7 (R21 HFS_DUPLICATE_CODE): ruleParams.<profile>.duplicateBlock is {lines: 8, tokens: 60} in the shipped manifest,
// the one definition of the threshold; a copy inside one owner counts like a copy across owners.
const A = 'src/modules/domain/alpha/alpha.service.ts';
const B = 'src/modules/domain/beta/beta.service.ts';
const A2 = 'src/modules/domain/alpha/alpha.contracts.ts';

/** A function of `statements + 4` lines: signature, accumulator, the body statements, return and the closing brace. */
function helper(name, statements, { literal = 1, variable = 'value' } = {}) {
  // Eleven line shapes, each lengthened by a chain of 0-6 operands chosen by the statement index: the shape sequence never repeats
  // inside a body of up to 77 statements, so a body is one block. A run that repeated would be a clone of the file with itself.
  const chain = (i) => ` + ${literal}`.repeat(i % 7);
  const patterns = [
    (i) => `  const ${variable}${i} = input.items[${i}] ?? ${literal}${chain(i)};`,
    (i) => `  if (${variable}${i - 1} > ${literal + i}${chain(i)}) total += ${variable}${i - 1};`,
    (i) => `  total = total * ${literal + 2} + ${i}${chain(i)};`,
    (i) => `  for (const entry of input.items) { total += entry * ${literal + i}${chain(i)}; }`,
    (i) => `  while (total > ${literal + i}${chain(i)}) total -= ${i};`,
    (i) => `  total = Math.max(total, input.items.length + ${literal + i}${chain(i)});`,
    (i) => `  input.items.push(total % ${literal + i + 1}${chain(i)});`,
    (i) => `  total += input.items.reduce((sum, item) => sum + item * ${literal + i}${chain(i)}, 0);`,
    (i) => `  if (!input.items.length) return ${literal + i}${chain(i)};`,
    (i) => `  total = input.items.map((item) => item + ${literal + i}${chain(i)}).length;`,
    (i) => `  try { total += JSON.parse(String(${i}${chain(i)})); } catch { total = ${literal}; }`,
  ];
  const body = Array.from({ length: statements }, (_, i) => patterns[i % patterns.length](i));
  return `export function ${name}(input: { items: number[] }) {\n  let total = 0;\n${body.join('\n')}\n  return total;\n}\n`;
}
const lineCount = (text) => text.trimEnd().split('\n').length;
const cloneOf = (statements, options) => `import { z } from 'zod';\n\n${helper('compute', statements, options)}`;
const run = (root) => { const report = runArch(root); return { report, hits: findings(report, 'HFS_DUPLICATE_CODE'), coverage: report.coverage.hfsMachine.clones }; };

// Sparse scaffold bodies can fall below the shipped token budget. A lower fixture budget proves the
// marker controls independently of formatting, while machine fixtures below retain the shipped 8/60 budget.
const atFixtureBudget = (files, profile = 'be') => checkClones({
  context: { ts },
  graph: {
    profile,
    files: new Map(Object.entries(files).map(([rel, text]) => [rel, { sourceFile: ts.createSourceFile(rel, text, ts.ScriptTarget.Latest, true, rel.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS) }])),
    unit: rel => rel,
    resolver: { ruleParams: () => ({ duplicateBlock: { lines: 3, tokens: 10 } }), classifyPath: () => ({ status: 'unowned' }) },
  },
}).violations;

test('a 30-line body copied to another owner with renamed identifiers and changed literals is one finding naming both files', (t) => {
  assert.equal(lineCount(helper('x', 26)), 30);
  const root = archFixture(t, { files: {
    [A]: cloneOf(26, { literal: 1, variable: 'value' }),
    [B]: `import { other } from './other';\n\n${helper('calculate', 26, { literal: 9, variable: 'item' })}`,
  } });
  const { hits, coverage } = run(root);
  assert.equal(hits.length, 1);
  assert.equal(hits[0].path, A);
  assert.equal(hits[0].twin.path, B);
  assert.ok(hits[0].lines >= 8);
  assert.ok(hits[0].message.includes(A) && hits[0].message.includes(B));
  assert.match(hits[0].message, /threshold 8 lines \/ 60 tokens/);
  assert.match(hits[0].message, /src\/modules\/platform\/primitives\//);
  assert.match(hits[0].message, /src\/modules\/domain\/<capability>\//);
  assert.equal(coverage.status, 'checked');
  assert.equal(coverage.minLines, 8);
  assert.equal(coverage.minTokens, 60);
  assert.equal(coverage.cloneBlocks, 1);
  assert.equal(coverage.ownersInvolved, 2);
  assert.ok(coverage.duplicatedLines >= 8);
});

test('the same block twice inside one owner is a finding that says to extract it inside the owner', (t) => {
  const root = archFixture(t, { files: { [A]: cloneOf(26), [A2]: helper('again', 26, { variable: 'item' }) } });
  const { hits, coverage } = run(root);
  assert.equal(hits.length, 1);
  assert.match(hits[0].message, /extract it once inside the owner/);
  assert.equal(coverage.cloneBlocks, 1);
  assert.equal(coverage.ownersInvolved, 1);
});

test('a 7-line clone across owners is below the line threshold', (t) => {
  assert.equal(lineCount(helper('x', 3)), 7);
  const root = archFixture(t, { files: { [A]: cloneOf(3), [B]: helper('calculate', 3, { variable: 'item' }) } });
  assert.equal(run(root).hits.length, 0);
});

test('a 12-line clone across owners is a finding', (t) => {
  assert.equal(lineCount(helper('x', 8)), 12);
  const root = archFixture(t, { files: { [A]: cloneOf(8), [B]: helper('calculate', 8, { variable: 'item' }) } });
  assert.equal(run(root).hits.length, 1);
});

test('different structure with the same size is not a clone', (t) => {
  const other = `export function shape(input: string[]) {\n${Array.from({ length: 30 }, (_, i) => `  for (const entry of input) { if (entry.length > ${i}) { console.log(entry); } }`).join('\n')}\n}\n`;
  const root = archFixture(t, { files: { [A]: cloneOf(26), [B]: other } });
  assert.equal(run(root).hits.length, 0);
});

test('the frontend message names the app modules and hooks homes', (t) => {
  const first = 'apps/web/src/modules/alpha/alpha.ts';
  const second = 'apps/web/src/modules/beta/beta.ts';
  const root = archFixture(t, { profile: 'fe', files: { [first]: cloneOf(26), [second]: helper('calculate', 26, { variable: 'item' }) } });
  const { hits } = run(root);
  assert.equal(hits.length, 1);
  assert.match(hits[0].message, /apps\/<app>\/src\/modules\/<capability>\/ when pure, apps\/<app>\/src\/hooks\/<domain>\/ for a React hook/);
});

const FE_APPS = [{ name: 'web', kind: 'next' }, { name: 'admin', kind: 'next' }];

test('a block copied between two apps of a front end says to move it to a package; between two owners of one app it says to extract inside the app', (t) => {
  const across = runArch(archFixture(t, { profile: 'fe', apps: FE_APPS, files: {
    'apps/web/src/hooks/cart/cart.shared.ts': helper('computeCart', 26),
    'apps/admin/src/hooks/cart/cart.shared.ts': helper('computeOrders', 26, { variable: 'item' }),
  } }));
  const between = findings(across, 'HFS_DUPLICATE_CODE').filter((hit) => hit.twin.path !== hit.path);
  assert.ok(between.length >= 1, JSON.stringify(between, null, 1));
  for (const hit of between) {
    assert.match(hit.message, /move it to a package \(packages\/<pkg>/);
    assert.doesNotMatch(hit.message, /extract it once/);
  }
  const within = runArch(archFixture(t, { profile: 'fe', apps: FE_APPS, files: {
    'apps/web/src/hooks/cart/cart.shared.ts': helper('computeCart', 26),
    'apps/web/src/hooks/order/order.shared.ts': helper('computeOrders', 26, { variable: 'item' }),
  } }));
  const inside = findings(within, 'HFS_DUPLICATE_CODE').filter((hit) => hit.twin.path !== hit.path);
  assert.ok(inside.length >= 1, JSON.stringify(inside, null, 1));
  for (const hit of inside) {
    assert.match(hit.message, /extract it once inside the app/);
    assert.doesNotMatch(hit.message, /package/);
  }
});

const API_APPS = [{ name: 'core', kind: 'api' }, { name: 'other', kind: 'api' }];

test('the main.ts of two api apps and thin resolvers of two features are uniform by design: not compared; the same bodies in app.module.ts and mappers are still a clone', (t) => {
  const entries = runArch(archFixture(t, { apps: API_APPS, files: {
    'apps/core/src/main.ts': helper('boot', 26),
    'apps/other/src/main.ts': helper('start', 26, { variable: 'item' }),
    'src/features/api/a/transport/graphql/a.resolver.ts': helper('resolveA', 26),
    'src/features/api/b/transport/graphql/b.resolver.ts': helper('resolveB', 26, { variable: 'item' }),
  } }));
  assert.deepEqual(findings(entries, 'HFS_DUPLICATE_CODE'), []);
  assert.equal(entries.coverage.hfsMachine.clones.cloneBlocks, 0);
  const shared = runArch(archFixture(t, { apps: API_APPS, files: {
    'apps/core/src/app.module.ts': helper('composeCore', 26),
    'apps/other/src/app.module.ts': helper('composeOther', 26, { variable: 'item' }),
    'src/features/api/a/transport/graphql/a.mapper.ts': helper('mapA', 26),
    'src/features/api/b/transport/graphql/b.mapper.ts': helper('mapB', 26, { variable: 'item' }),
  } }));
  const paths = findings(shared, 'HFS_DUPLICATE_CODE').flatMap((hit) => [hit.path, hit.twin.path]);
  assert.ok(paths.includes('apps/core/src/app.module.ts'), paths.join(', '));
  assert.ok(paths.includes('src/features/api/a/transport/graphql/a.mapper.ts'), paths.join(', '));
});

const canonHandler = (name, extra = '') => `import { CommandHandler } from '@nestjs/cqrs';
import { ICQRSHandler } from '@modules/platform/cqrs';
import { InjectLogger, type Logger } from '@modules/platform/logging';
@CommandHandler(${name}Command)
export class ${name}Handler extends ICQRSHandler<${name}Command, ${name}Result> {
  constructor(
    @InjectLogger() logger: Logger,
    private readonly service: ${name}Service,
  ) {
    super(logger);
  }
  protected override process(command: ${name}Command): Promise<${name}Result> {
    ${extra}
    return this.service.perform(
      command.params.principal.id,
      {
        id: command.params.request.id,
        request: command.params.request,
      },
    );
  }
}
`;

const canonJob = (name, extra = '') => `import { Injectable } from '@nestjs/common';
import { InjectJobClaims, type JobClaims, type JobStep, type ClaimedJob } from '@modules/platform/jobs';
@Injectable()
export class ${name}Step implements JobStep {
  constructor(
    private readonly service: ${name}Service,
    @InjectJobClaims() private readonly claims: JobClaims,
  ) {}
  async run(job: ClaimedJob): Promise<void> {
    await this.claims.advance({
      jobId: job.jobId,
      expectedFencingToken: job.fencingToken,
      step: '${name.toLowerCase()}',
    });
    ${extra}
    await this.service.perform(
      job.payload,
      this.claims.runKey(job, '${name.toLowerCase()}'),
    );
  }
}
`;

const canonQueue = (name, extra = '') => `import { InjectQueueOutbox, type QueueOutbox } from '@modules/platform/queue';
export const ${name.toUpperCase()}_QUEUE = '${name.toLowerCase()}';
export class ${name}Queue {
  constructor(
    @InjectQueueOutbox()
    private readonly outbox: QueueOutbox,
  ) {}
  enqueue(payload: ${name}Payload, tx: EntityManager): Promise<void> {
    ${extra}
    return this.outbox.write(
      tx,
      ${name.toUpperCase()}_QUEUE,
      payload,
    );
  }
}
`;

const canonList = (name, extra = '') => `import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager, LIST_ROWS_MAX } from '@modules/platform/database';
export class ${name}Service {
  constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}
  async list(params: ${name}Params): Promise<Array<${name}Result>> {
    const rows = await this.entityManager.find(${name}Entity, {
      where: { principalId: params.principalId },
      order: { createdAt: 'DESC' },
      take: LIST_ROWS_MAX,
    });
    ${extra}
    return rows.map((row) => ({
      id: row.id,
      body: row.body,
      createdAt: row.createdAt.toISOString(),
    }));
  }
}
`;

const canonFind = (name) => `import type { EntityManager } from 'typeorm';
import { InjectPrimaryEntityManager } from '@modules/platform/database';
export class ${name}Projection {
  constructor(@InjectPrimaryEntityManager() private readonly entityManager: EntityManager) {}
  async get(id: string) {
    const row = await this.entityManager.findOne(${name}Entity, {
      where: {
        id,
      },
    });
    return row ? {
      id: row.id,
      title: row.title,
      details: { body: row.body },
    } : null;
  }
}
`;

const canonOwnedRead = (name) => `import { requireOwnedRow } from '@modules/platform/database';
export class ${name}Service {
  find(principalId: string, id: string) {
    return requireOwnedRow<Pick<${name}Row, 'id'>>(
      this.entityManager,
      FIND_${name.toUpperCase()},
      id,
      principalId,
      () => {
        throw new ${name}Error({
          code: ${name}ErrorCode.NotFound,
          params: { id },
        });
      },
    );
  }
}
`;

for (const [label, build, paths, declaration] of [
  ['job step fence and one delegation', canonJob, ['src/features/jobs/alpha/steps/alpha.step.ts', 'src/features/jobs/beta/steps/beta.step.ts'], { patterns: ['fenced-job'] }],
  ['CQRS handler logger and mapped delegation', canonHandler, ['src/features/api/alpha/application/alpha.handler.ts', 'src/features/api/beta/application/beta.handler.ts'], {}],
  ['queue outbox producer', canonQueue, ['src/modules/queues/alpha/alpha.queue.ts', 'src/modules/queues/beta/beta.queue.ts'], { patterns: ['queue'] }],
  ['bounded find list and DTO mapping', canonList, [A, B], {}],
  ['find-one nullable projection mapping', canonFind, [A, B], {}],
  ['owned-row find helper and typed not-found shape', canonOwnedRead, [A, B], {}],
]) {
  test(`canon ${label} is ignored through its imported markers; the same shape without those markers remains compared`, (t) => {
    const files = { [paths[0]]: build('Alpha'), [paths[1]]: build('Beta') };
    assert.deepEqual(run(archFixture(t, { files, declaration })).hits, []);
    const unrelated = Object.fromEntries(Object.entries(files).map(([rel, text]) => [rel, text.replaceAll('@modules/platform/', '@unrelated/')]));
    for (const text of Object.values(files)) {
      const source = ts.createSourceFile('shape.ts', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
      assert.ok(canonCloneNodes(ts, source, 'be').size > 0, `${label} must match its imported marker`);
    }
    assert.ok(atFixtureBudget(unrelated).length > 0, `unmarked ${label} must stay compared`);
  });
}

test('data queue definitions and scheduler definitions are canon; executable queue configuration remains compared', (t) => {
  const definition = (name) => `import { defineQueue, type QueueSchedulerDefinition } from '@modules/platform/queue';
export const ${name} = defineQueue<Payload>({
  name: '${name}',
  attempts: 5,
  backoff: {
    type: 'exponential',
    delayMs: 1000,
  },
  defaults: { retained: [1, 2], enabled: true },
});
export const ${name}Scheduler = (options: Options): QueueSchedulerDefinition => ({
  queue: ${name},
  id: '${name}',
  everyMs: options.everyMs,
  payload: {
    id: options.id,
    details: { kind: options.kind },
  },
});
`;
  const first = 'src/modules/queues/alpha/alpha.queue.ts';
  const second = 'src/modules/queues/beta/beta.queue.ts';
  const declaration = { patterns: ['queue'] };
  assert.deepEqual(run(archFixture(t, { declaration, files: { [first]: definition('Alpha'), [second]: definition('Beta') } })).hits, []);
  const body = helper('compute', 26).replace(/^export function compute\([^\n]+\) \{/, '(input: { items: number[] }) => {');
  const custom = (name) => `import { defineQueue } from '@modules/platform/queue';\nexport const ${name} = defineQueue({\n  name: '${name}',\n  compute: ${body}\n});\n`;
  const hits = run(archFixture(t, { declaration, files: { [first]: custom('Alpha'), [second]: custom('Beta') } })).hits;
  assert.ok(hits.some(hit => hit.lines >= 8));
});

test('custom business statements inside canon steps, handlers, producers and list reads are still compared', (t) => {
  const business = helper('compute', 26).split('\n').slice(1, -2).join('\n');
  for (const [build, first, second, declaration] of [
    [canonJob, 'src/features/jobs/alpha/steps/alpha.step.ts', 'src/features/jobs/beta/steps/beta.step.ts', { patterns: ['fenced-job'] }],
    [canonHandler, 'src/features/api/alpha/application/alpha.handler.ts', 'src/features/api/beta/application/beta.handler.ts', {}],
    [canonQueue, 'src/modules/queues/alpha/alpha.queue.ts', 'src/modules/queues/beta/beta.queue.ts', { patterns: ['queue'] }],
    [canonList, A, B, {}],
  ]) {
    const hits = run(archFixture(t, { declaration, files: { [first]: build('Alpha', business), [second]: build('Beta', business) } })).hits;
    assert.ok(hits.some(hit => hit.lines >= 8), `custom ${build.name} body must be compared`);
  }
});

const frameProps = `navigation={{
      brand: t('brand'),
      current: ROUTES.home,
      routes: [
        { href: ROUTES.home, label: t('home') },
        { href: ROUTES.catalog, label: t('catalog'), badge: 1 },
      ],
      display: {
        locale,
        label: t('display'),
        localeNames: { en: t('english'), vi: t('vietnamese') },
      },
      footer: { caption: t('footer'), links: [ROUTES.terms, ROUTES.privacy] },
    }}`;
const framePage = (name, { imported = true, custom = '' } = {}) => `${imported ? "import { SiteFrame } from '@fixture/ui';" : 'const SiteFrame = () => <main />;'}
import { useTranslations } from 'next-intl';
export const ${name}Page = () => {
  const t = useTranslations('${name}');
  return <SiteFrame
    ${frameProps}
    ${custom}
  />;
};
`;

test('data-only JSX prop objects of an imported shared frame are canon, including translations and nested contracts', (t) => {
  const first = 'apps/web/src/features/pages/AlphaPage/index.tsx';
  const second = 'apps/web/src/features/pages/BetaPage/index.tsx';
  assert.deepEqual(run(archFixture(t, { profile: 'fe', files: { [first]: framePage('Alpha'), [second]: framePage('Beta') } })).hits, []);
  const unrelated = { [first]: framePage('Alpha', { imported: false }), [second]: framePage('Beta', { imported: false }) };
  for (const text of Object.values(unrelated)) assert.equal(canonCloneNodes(ts, ts.createSourceFile('shape.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX), 'fe').size, 0);
  assert.ok(atFixtureBudget(unrelated, 'fe').length > 0);
});

test('a copied business callback in props of a shared frame is retained beside canon data objects', (t) => {
  const body = helper('compute', 26).replace(/^export function compute\([^\n]+\) \{/, '(input: { items: number[] }) => {');
  const custom = `on={{ labels: { save: t('save') }, compute: ${body} }}`;
  const files = {
    'apps/web/src/features/pages/AlphaPage/index.tsx': framePage('Alpha', { custom }),
    'apps/web/src/features/pages/BetaPage/index.tsx': framePage('Beta', { custom }),
  };
  assert.ok(run(archFixture(t, { profile: 'fe', files })).hits.some(hit => hit.lines >= 8));
});

test('canon removal ends token segments while the default tokenizer keeps every runtime node', () => {
  const source = ts.createSourceFile('page.tsx', `${framePage('Alpha')}\nexport const remaining = 1;\n`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const excluded = canonCloneNodes(ts, source, 'fe');
  assert.equal(excluded.size, 1);
  const all = tokenize(ts, source);
  const filtered = tokenize(ts, source, { excluded });
  assert.ok(all.kinds.length > filtered.kinds.length);
  assert.equal(new Set(all.segments).size, 1);
  assert.equal(new Set(filtered.segments).size, 2);
});

test('a nested parameter named defineQueue does not inherit the imported canon marker', (t) => {
  const shape = (name) => `import { defineQueue } from '@modules/platform/queue';
export function ${name}(defineQueue: (config: object) => number, input: Input) {
  const config = defineQueue({
    id: input.id,
    primary: { value: input.value, enabled: true },
    items: [input.id, input.otherId],
    nested: { values: [input.value, 2, 3], enabled: false },
    names: [{ first: input.id }, { second: input.id }],
    settings: { mode: 'normal', level: input.value, flags: ['a', 'b'] },
    routes: [{ href: input.id, label: input.title }, { href: input.otherId, label: input.description }],
    source: input.source,
    display: { label: input.label, localeNames: { en: input.english, vi: input.vietnamese } },
    fallback: input.fallback,
  });
  return config;
}
`;
  const files = { [A]: shape('first'), [B]: shape('second') };
  assert.ok(run(archFixture(t, { files })).hits.length > 0);
});

test('a shadowed shared frame or translator preserves its ordinary prop objects', () => {
  const shadowedComponent = `import { SiteFrame } from '@fixture/ui';\nexport function Page(SiteFrame: Component) { return <SiteFrame ${frameProps} />; }`;
  const shadowedTranslation = `import { SiteFrame } from '@fixture/ui';\nimport { useTranslations } from 'next-intl';\nconst t = useTranslations('page');\nexport function Page(t: CustomFormatter) { return <SiteFrame ${frameProps} />; }`;
  for (const text of [shadowedComponent, shadowedTranslation]) {
    const source = ts.createSourceFile('page.tsx', text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    assert.equal(canonCloneNodes(ts, source, 'fe').size, 0);
  }
});
