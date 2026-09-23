import { defineConfig } from 'vitest/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { storybookTest } from '@storybook/addon-vitest/vitest-plugin';
import { playwright } from '@vitest/browser-playwright';
import { viteFsAllow } from './.storybook/vite-fs-allow.ts';

const dirname = path.dirname(fileURLToPath(import.meta.url));

/*
 * The Storybook a11y gate: `npm run test:a11y`. Every story runs in Chromium once per family ×
 * theme, addon-a11y runs axe after each render, and `.storybook/a11y-gate.ts` fails the story on
 * any violation not waived in `.storybook/a11y-allowlist.json`.
 *
 * `system` runs with the browser in dark mode, so it exercises the prefers-color-scheme path
 * (`light` and `dark` already cover the explicit scopes). One cell:
 *   npm run test:a11y -- --project "a11y:offset-pop:dark"
 */
const FAMILIES = ['common', 'core', 'heritage', 'offset-pop'] as const;
const THEMES = [
  { theme: 'light', colorScheme: 'light' },
  { theme: 'dark', colorScheme: 'light' },
  { theme: 'system', colorScheme: 'dark' },
] as const;

export default defineConfig({
  server: { fs: { allow: viteFsAllow(dirname) } },
  test: {
    projects: FAMILIES.flatMap((family, familyIndex) =>
      THEMES.map(({ theme, colorScheme }, themeIndex) => ({
        extends: true,
        plugins: [storybookTest({ configDir: path.join(dirname, '.storybook') })],
        test: {
          name: `a11y:${family}:${theme}`,
          // One cell at a time (its story files still run in parallel pages): twelve Chromium
          // sessions at once drop browser connections on an ordinary machine.
          sequence: { groupOrder: familyIndex * THEMES.length + themeIndex },
          env: {
            VITE_GRAMMAR_FAMILY: family,
            VITE_GRAMMAR_THEME: theme,
            // The gate, not the addon, decides pass/fail, so keep the addon reporting in todo mode.
            VITE_A11Y_TEST: 'todo',
          },
          setupFiles: [path.join(dirname, '.storybook/a11y-gate.ts')],
          browser: {
            enabled: true,
            headless: true,
            provider: playwright({ contextOptions: { colorScheme } }),
            instances: [{ browser: 'chromium' as const }],
          },
        },
      })),
    ),
  },
});
