import parser from '@typescript-eslint/parser';

const literalColour = /(?:^|[\s:[(])#[0-9a-f]{3,8}(?![0-9a-f])|\b(?:rgb|rgba|hsl|hsla|oklch|oklab|color)\s*\(/i;

const noLiteralColours = {
  meta: { type: 'problem', messages: { literal: 'Use a semantic design token instead of a literal colour.' } },
  create(context) {
    const check = (node, value) => {
      if (literalColour.test(value)) context.report({ node, messageId: 'literal' });
    };
    return {
      Literal(node) { if (typeof node.value === 'string') check(node, node.value); },
      TemplateElement(node) { check(node, node.value.raw); },
      JSXAttribute(node) { if (typeof node.value?.value === 'string') check(node.value, node.value.value); },
    };
  },
};

export default [{
  files: ['src/app.tsx', 'src/router.ts', 'src/api/**/*.ts', 'src/i18n/**/*.ts', 'src/components/**/*.tsx', 'src/pages/**/*.tsx'],
  ignores: ['src/components/ui/**'],
  languageOptions: { parser, parserOptions: { ecmaFeatures: { jsx: true }, sourceType: 'module' } },
  plugins: { starci: { rules: { 'no-literal-colours': noLiteralColours } } },
  rules: { 'starci/no-literal-colours': 'error' },
}];
