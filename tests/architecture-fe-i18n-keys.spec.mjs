import test from 'node:test';
import assert from 'node:assert/strict';
import { archFixture, runArch, findings } from './_hfs-arch-fixture.mjs';

// R102 i18n-keys (FE_I18N_KEYS): the catalogs of an app and the source that reads them agree: a literal key read through next-intl is in
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
