// proves: FE_I18N_LITERAL@lite
// proves: FE_I18N_LITERAL@full
import test from 'node:test';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { at, fixtureHfs, LITE_FE_DECLARATION } from './fixtures/typed/tester.mjs';
import { htmlLangFromLocale } from './next-conventions.mjs';
import { noCopyResolutionBelowBlock, noHardcodedCopy } from './translation.mjs';

for (const edition of ['lite', 'full']) {
  test(`${edition} translated display copy and locale metadata pass; literal copy and lower-tier resolution fail`, () => {
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
      settings: { starci: { hfs: fixtureHfs(LITE_FE_DECLARATION, { lite: edition === 'lite' }) } },
    });
    const block = at('apps/web/src/components/blocks/Feed/index.tsx');
    const leaf = at('apps/web/src/components/leaves/Input/index.tsx');
    tester.run('no-hardcoded-copy', noHardcodedCopy, {
      valid: [{ filename: block, code: 'const E = () => <p>{t("empty")}</p>;' }],
      invalid: [{ filename: block, code: 'const E = () => <p>Nothing to show yet</p>;', errors: [{ messageId: 'text' }] }],
    });
    tester.run('html-lang-from-locale', htmlLangFromLocale, {
      valid: [{ filename: at('apps/web/src/app/[locale]/layout.tsx'), code: 'const Layout = ({ locale }) => <html lang={locale}><body /></html>;' }],
      invalid: [{ filename: at('apps/web/src/app/[locale]/layout.tsx'), code: 'const Layout = () => <html lang="en"><body /></html>;', errors: [{ messageId: 'lang' }] }],
    });
    tester.run('no-copy-resolution-below-block', noCopyResolutionBelowBlock, {
      valid: [{ filename: leaf, code: 'const E = ({ props }) => <input placeholder={props.placeholder} />;' }],
      invalid: [{ filename: leaf, code: 'const t = useTranslations("input");', errors: [{ messageId: 'resolves' }] }],
    });
  });
}
