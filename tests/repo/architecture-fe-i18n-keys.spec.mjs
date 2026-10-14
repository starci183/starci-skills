import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from '../helpers/hfs-arch-fixture.mjs';

// R106 i18n-keys (FE_I18N_KEYS): the catalogs of an app and the source that reads them agree: a literal key read through next-intl is in
// every locale, and a catalog key that no string of the app's or the shared packages' source can be reading is dead.
const CATALOG_DIR = 'apps/web/src/modules/i18n/messages';
const catalog = (extra = {}) => `${JSON.stringify({ home: { title: 'Trang chu', subtitle: 'Mo ta' }, common: { save: 'Luu' }, ...extra })}\n`;
const CLEAN = {
  'apps/web/src/app/.keep': null,
  [`${CATALOG_DIR}/vi.json`]: catalog(),
  [`${CATALOG_DIR}/en.json`]: catalog(),
  'apps/web/src/modules/i18n/use-copy.ts': [
    "import { useTranslations } from 'next-intl';",
    "import { getTranslations } from 'next-intl/server';",
    "export const useHome = () => { const t = useTranslations('home'); return [t('title'), t.rich('subtitle')]; };",
    "export const readCommon = async () => { const t = await getTranslations({ namespace: 'common' }); return t('save'); };",
    '',
  ].join('\n'),
};
const hits = report => findings(report, 'FE_I18N_KEYS');
const run = (t, extra = {}) => runArch(archFixture(t, { profile: 'fe', files: { ...CLEAN, ...extra } }));

test('keys read through useTranslations and getTranslations, in every locale, and no dead key raise no FE_I18N_KEYS', t => {
  const report = run(t);
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
  assert.equal(report.coverage.hfsMachine.i18nKeys.status, 'checked');
  assert.ok(report.coverage.checkedRuleIds.includes('FE_I18N_KEYS'));
});

test('a literal key that a locale does not hold, in a namespaced read and in a rich read, is FE_I18N_KEYS', t => {
  const report = run(t, {
    [`${CATALOG_DIR}/en.json`]: catalog({ home: { title: 'Home' } }),
    'apps/web/src/modules/i18n/use-missing.ts': "import { useTranslations } from 'next-intl';\nexport const useMissing = () => { const t = useTranslations('home'); return [t('nope'), t.rich('gone')]; };\n",
  });
  const keys = hits(report).filter(item => item.path.endsWith('use-missing.ts')).map(item => item.key).sort();
  assert.deepEqual(keys, ['home.gone', 'home.nope']);
});

test('a catalog key that no string of the source reads is FE_I18N_KEYS, and a key reached by a tail, a template or a table of keys is not', t => {
  const report = run(t, {
    [`${CATALOG_DIR}/vi.json`]: catalog({ orders: { card: { title: 'The' }, status: { paid: 'Paid', due: 'Due' } }, dead: { key: 'x' } }),
    [`${CATALOG_DIR}/en.json`]: catalog({ orders: { card: { title: 'The' }, status: { paid: 'Paid', due: 'Due' } }, dead: { key: 'x' } }),
    'apps/web/src/modules/i18n/use-orders.ts': "import { useTranslations } from 'next-intl';\nconst KEYS = ['paid', 'due'];\nexport const useOrders = (state: string) => { const t = useTranslations('orders.status'); return [t(`${state}`), KEYS, useTranslations('orders.card')('title')]; };\n",
  });
  assert.deepEqual(hits(report).map(item => item.key), ['dead.key']);
});

test('a translator that is not next-intl, a computed namespace and a computed key are never judged', t => {
  const report = run(t, {
    'apps/web/src/modules/i18n/other.ts': "import { useTranslations } from 'other-i18n';\nexport const a = () => { const t = useTranslations('home'); return t('missing'); };\n",
    'apps/web/src/modules/i18n/computed.ts': "import { useTranslations } from 'next-intl';\nexport const b = (ns: string, k: string) => { const t = useTranslations(ns); const u = useTranslations('home'); return [t('missing'), u(k)]; };\n",
  });
  assert.deepEqual(hits(report), [], JSON.stringify(hits(report), null, 1));
});

test('in-segment template reads through t, tw and server translators keep matching catalog keys alive', t => {
  const extra = {
    hiring: { stage_new: 'New', stage_review: 'Review', stage_: 'Empty', stages_new: 'Unused' },
    workbench: { level_low_label: 'Low', level_high_label: 'High', level_low_caption: 'Unused' },
    orders: { ready_paid: { label_short: 'Short', label_long: 'Long', caption: 'Unused' } },
    server: { result_ok: 'OK', result_failed: 'Failed' },
  };
  const report = run(t, {
    [`${CATALOG_DIR}/vi.json`]: catalog(extra),
    [`${CATALOG_DIR}/en.json`]: catalog(extra),
    'apps/web/src/modules/i18n/use-dynamic.ts': [
      "import { useTranslations as useCopy } from 'next-intl';",
      "import { getTranslations } from 'next-intl/server';",
      'export const useDynamic = (stage: string, level: string, kind: string, state: string, style: string) => {',
      "  const t = useCopy('hiring');",
      "  const tw = useCopy('workbench');",
      "  const orders = useCopy('orders');",
      '  return [t(`stage_${stage}`), tw.rich(`level_${level}_label`), orders.raw(`${kind}_${state}.label_${style}`)];',
      '};',
      "export const readResult = async (state: string) => { const tw = await getTranslations({ namespace: 'server' }); return tw.markup(`result_${state}`); };",
      '',
    ].join('\n'),
  });
  assert.deepEqual(hits(report).map(item => item.key), ['hiring.stages_new', 'orders.ready_paid.caption', 'workbench.level_low_caption']);
});

test('template static fragments and string literals keep their metacharacters literal', t => {
  const extra = {
    badges: { 'badge[ok]?+': 'OK', badgeok: 'Unused', 'tag*_ready': 'Ready', tag_ready: 'Unused' },
    exact: { 'literal_*': 'Literal', literal_one: 'Unused', 'template_*': 'Template', template_one: 'Unused' },
  };
  const report = run(t, {
    [`${CATALOG_DIR}/vi.json`]: catalog(extra),
    [`${CATALOG_DIR}/en.json`]: catalog(extra),
    'apps/web/src/modules/i18n/use-symbols.ts': [
      "import { useTranslations } from 'next-intl';",
      'export const useSymbols = (state: string) => {',
      "  const t = useTranslations('badges');",
      "  const exact = useTranslations('exact');",
      "  return [t(`badge[${state}]?+`), t(`tag*_${state}`), exact('literal_*'), exact(`template_*`)];",
      '};',
      '',
    ].join('\n'),
  });
  assert.deepEqual(hits(report).map(item => item.key), ['badges.badgeok', 'badges.tag_ready', 'exact.literal_one', 'exact.template_one']);
});

test('whole-segment and shared-package template reads keep matching tails alive without crossing dotted segments', t => {
  const extra = {
    orders: { status: { paid: 'Paid', due: 'Due' }, nested: { status: { pending: 'Pending' } } },
    shared: { copy_ready_label: 'Ready', copy_pending_label: 'Pending', copy_ready_caption: 'Unused', copy_ready: { child_label: 'Unused' } },
  };
  const report = run(t, {
    'tsconfig.json': JSON.stringify({ compilerOptions: { target: 'ES2022', module: 'ESNext', moduleResolution: 'Bundler', skipLibCheck: true, noEmit: true }, include: ['apps/**/*', 'packages/**/*'] }),
    [`${CATALOG_DIR}/vi.json`]: catalog(extra),
    [`${CATALOG_DIR}/en.json`]: catalog(extra),
    'apps/web/src/modules/i18n/use-status.ts': 'export const statusKey = (state: string) => `status.${state}`;\n',
    'packages/ui/src/copy.ts': 'export const sharedKey = (state: string) => `copy_${state}_label`;\n',
  });
  assert.deepEqual(hits(report).map(item => item.key), ['shared.copy_ready.child_label', 'shared.copy_ready_caption']);
});

test('templates containing only interpolations do not make every catalog key live', t => {
  const report = run(t, {
    [`${CATALOG_DIR}/vi.json`]: catalog({ unused: { alpha: 'A', beta: 'B', child: { gamma: 'C' } } }),
    [`${CATALOG_DIR}/en.json`]: catalog({ unused: { alpha: 'A', beta: 'B', child: { gamma: 'C' } } }),
    'apps/web/src/modules/i18n/use-unknown.ts': [
      "import { useTranslations } from 'next-intl';",
      "export const useUnknown = (left: string, right: string) => { const tw = useTranslations('unused'); return [tw(`${left}`), tw(`${left}${right}`), tw(`${left}.${right}`)]; };",
      '',
    ].join('\n'),
  });
  assert.deepEqual(hits(report).map(item => item.key), ['unused.alpha', 'unused.beta', 'unused.child.gamma']);
});
