import type { Preview } from '@storybook/react-vite';
import React from 'react';
import '../node_modules/@heroui/styles/dist/heroui.min.css';
import '../src/common/styles.css';
import '../src/core/styles.css';
import { GrammarRoot } from '../src/common/index.js';

const preview: Preview = {
  decorators: [
    (Story) => (
      <GrammarRoot
        data-grammar-family="core"
        style={{ minHeight: '100vh', ['--starci-core-accent' as string]: '#2F6BFF' }}
      >
        <Story />
      </GrammarRoot>
    ),
  ],
  parameters: {
    layout: 'fullscreen',
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    a11y: {
      test: 'todo',
    },
  },
};

export default preview;
