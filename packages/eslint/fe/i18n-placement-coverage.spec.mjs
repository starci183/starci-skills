// proves: FE_I18N_PLACEMENT@lite
// proves: FE_I18N_PLACEMENT@full
// proves: FE_I18N_NAVIGATION@lite
// proves: FE_I18N_NAVIGATION@full
// proves: FE_I18N_FORMATTER@lite
// proves: FE_I18N_FORMATTER@full
import test from 'node:test';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { at, fixtureHfs, LITE_FE_DECLARATION } from './fixtures/typed/tester.mjs';
import { i18nStackInOneModule, localeSegmentIsLocale, navigationFromIntl, noNativeAnchor, noSecondI18nStack } from './next-conventions.mjs';
import { useIntlFormatter } from './formatting.mjs';

for (const edition of ['lite', 'full']) {
  test(`${edition} locale-owned i18n passes while misplaced locale stacks, navigation and formatting fail`, () => {
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module' },
      settings: { starci: { hfs: fixtureHfs(LITE_FE_DECLARATION, { lite: edition === 'lite' }) } },
    });
    const block = at('apps/web/src/components/blocks/Nav/index.tsx');
    tester.run('locale-segment-is-locale', localeSegmentIsLocale, {
      valid: [{ filename: at('apps/web/src/app/[locale]/page.tsx'), code: 'export default function Page() {}' }],
      invalid: [{ filename: at('apps/web/src/app/[lang]/page.tsx'), code: 'export default function Page() {}', errors: [{ messageId: 'segment' }] }],
    });
    tester.run('no-second-i18n-stack', noSecondI18nStack, {
      valid: [{ filename: block, code: 'import { useTranslations } from "next-intl";' }],
      invalid: [{ filename: block, code: 'import { t } from "@lingui/core";', errors: [{ messageId: 'stack' }] }],
    });
    const routing = 'import { defineRouting } from "next-intl/routing"; export const routing = defineRouting({ locales: ["vi"], defaultLocale: "vi" });';
    tester.run('i18n-stack-in-one-module', i18nStackInOneModule, {
      valid: [{ filename: at('apps/web/src/modules/i18n/routing.ts'), code: routing }],
      invalid: [{ filename: at('apps/web/src/hooks/lesson/useLesson.ts'), code: routing, errors: [{ messageId: 'stack' }] }],
    });
    tester.run('navigation-from-intl', navigationFromIntl, {
      valid: [{ filename: block, code: 'import { Link } from "@/modules/i18n/navigation";' }],
      invalid: [{ filename: block, code: 'import Link from "next/link";', errors: [{ messageId: 'link' }] }],
    });
    tester.run('no-native-anchor', noNativeAnchor, {
      valid: [{ filename: block, code: 'const Nav = () => <Link href={routes.home()} />;' }],
      invalid: [{ filename: block, code: 'const Nav = () => <a href="/courses" />;', errors: [{ messageId: 'internal' }] }],
    });
    tester.run('use-intl-formatter', useIntlFormatter, {
      valid: [{ filename: block, code: 'const Nav = () => <p>{format.number(total)}</p>;' }],
      invalid: [{ filename: block, code: 'const label = total.toLocaleString("en-US");', errors: [{ messageId: 'method' }] }],
    });
  });
}
