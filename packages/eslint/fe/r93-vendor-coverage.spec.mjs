// proves: FE_VENDOR_BOUNDARY@lite
// proves: FE_VENDOR_BOUNDARY@full
import test from 'node:test';
import tsParser from '@typescript-eslint/parser';
import { RuleTester } from 'eslint';
import { at, fixtureHfs } from './fixtures/typed/tester.mjs';
import { noVendorIconOutsideIconLeaf, heroiconsIsTheGlyphVendor, noOffScaleGlyphSize, noDecorativeIconInMetricCell } from './icon.mjs';
import { vendorPrimitiveHasNamedOwner } from './vendor-boundary.mjs';

for (const edition of ['lite', 'full']) {
  test(`${edition} valid vendor owners pass and invalid vendor boundaries are rejected`, () => {
    const tester = new RuleTester({
      languageOptions: { parser: tsParser, ecmaVersion: 2022, sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
      settings: { starci: { hfs: fixtureHfs(undefined, { lite: edition === 'lite' }) } },
    });
    tester.run('no-vendor-icon-outside-icon-leaf', noVendorIconOutsideIconLeaf, {
      valid: [{ filename: at('apps/web/src/components/leaves/Icon/index.tsx'), code: 'import { StarIcon } from "@heroicons/react/24/outline";' }],
      invalid: [{ filename: at('apps/web/src/components/leaves/Badge/index.tsx'), code: 'import { StarIcon } from "@heroicons/react/24/outline";', errors: [{ messageId: 'vendor' }] }],
    });
    tester.run('heroicons-is-the-glyph-vendor', heroiconsIsTheGlyphVendor, {
      valid: [{ filename: at('apps/web/src/components/leaves/Icon/index.tsx'), code: 'import { StarIcon } from "@heroicons/react/24/outline";' }],
      invalid: [{ filename: at('apps/web/src/components/leaves/Icon/index.tsx'), code: 'import { Star } from "lucide-react";', errors: [{ messageId: 'vendor' }] }],
    });
    tester.run('no-off-scale-glyph-size', noOffScaleGlyphSize, {
      valid: [{ filename: at('apps/web/src/components/leaves/Icon/index.tsx'), code: 'const C = "size-4 shrink-0";' }],
      invalid: [{ filename: at('apps/web/src/components/leaves/Icon/index.tsx'), code: 'const C = "size-3.5 shrink-0";', errors: [{ messageId: 'offScale' }] }],
    });
    tester.run('no-decorative-icon-in-metric-cell', noDecorativeIconInMetricCell, {
      valid: [{ filename: at('apps/web/src/components/composites/LabelledProgressRow/index.tsx'), code: 'const Row = () => <Text />;' }],
      invalid: [{ filename: at('apps/web/src/components/composites/LabelledProgressRow/index.tsx'), code: 'const Row = () => <Icon props={{ name: "course" }} />;', errors: [{ messageId: 'decorative' }] }],
    });
    tester.run('vendor-primitive-has-named-owner', vendorPrimitiveHasNamedOwner, {
      valid: [{ filename: at('apps/web/src/components/leaves/Badge/index.tsx'), code: 'import { Card } from "@heroui/react";' }],
      invalid: [{ filename: at('apps/web/src/components/blocks/CourseCard/index.tsx'), code: 'import { Card } from "@heroui/react";', errors: [{ messageId: 'owner' }] }],
    });
  });
}
