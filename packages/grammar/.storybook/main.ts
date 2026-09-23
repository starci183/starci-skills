import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { StorybookConfig } from '@storybook/react-vite';
import { viteFsAllow } from './vite-fs-allow.ts';

const packageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const config: StorybookConfig = {
  "stories": [
    "../src/**/*.mdx",
    "../src/**/*.stories.@(js|jsx|mjs|ts|tsx)"
  ],
  "addons": [
    "@chromatic-com/storybook",
    "@storybook/addon-vitest",
    "@storybook/addon-a11y",
    "@storybook/addon-docs",
    "@storybook/addon-mcp"
  ],
  "framework": "@storybook/react-vite",
  // Serve node_modules even when it is a junction into another checkout (see vite-fs-allow.ts).
  viteFinal: (viteConfig) => ({
    ...viteConfig,
    server: {
      ...viteConfig.server,
      fs: { ...viteConfig.server?.fs, allow: [...(viteConfig.server?.fs?.allow ?? []), ...viteFsAllow(packageRoot)] },
    },
  }),
};
export default config;
