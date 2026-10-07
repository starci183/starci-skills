import test from 'node:test';
import assert from 'node:assert/strict';
import { importClausesOf, importSpecifiersOf } from '../../scripts/work/layout-imports.mjs';

// The layout scan follows a layout's imports and reads which components it imports. Both reads are linear in the
// source text: a statement never crosses a quote, and the stem before its opening quote is judged once.

test('importSpecifiersOf reads import, re-export and side-effect specifiers in order', () => {
  const source = [
    "import Link from 'next/link';",
    'import type { Metadata } from "next";',
    "export * from './nav';",
    "export type { Item } from '../types';",
    "import './globals.css';",
    "const note = 'import nothing from here';",
  ].join('\n');
  assert.deepEqual(importSpecifiersOf(source), ['next/link', 'next', './nav', '../types', './globals.css']);
});

test('importSpecifiersOf skips a statement that no quote closes and keeps the next one', () => {
  assert.deepEqual(importSpecifiersOf("import a from `tpl`; import b from './b'"), ['./b']);
  assert.deepEqual(importSpecifiersOf("import ; import './c'"), ['./c']);
  assert.deepEqual(importSpecifiersOf("import x from ''; import y from 'y'"), ['y']);
  assert.deepEqual(importSpecifiersOf('import a from'), []);
});

test('importSpecifiersOf reads a stem whose clause carries the word from or type', () => {
  assert.deepEqual(importSpecifiersOf("import type  from 'a'"), ['a']);
  assert.deepEqual(importSpecifiersOf("import { from } from 'b'"), ['b']);
  assert.deepEqual(importSpecifiersOf("import  from 'c'"), ['c']);
  assert.deepEqual(importSpecifiersOf("import from 'd'"), []);
});

test('importClausesOf returns the clause between import and from, without type', () => {
  const source = [
    "import Shell from './shell';",
    "import type  Props from './props';",
    "import { A, B as C }  from './ab';",
    "import * as Icons from './icons';",
    "import './side-effect';",
    "export { Shell } from './shell';",
  ].join('\n');
  assert.deepEqual(importClausesOf(source), ['Shell', 'Props', '{ A, B as C }', '* as Icons']);
});

test('importClausesOf reads type as the clause when one space follows it', () => {
  assert.deepEqual(importClausesOf("import type from 'a'"), ['type']);
  assert.deepEqual(importClausesOf("import type  from 'a'"), ['']);
});

test('both reads stay fast on text with many keywords and no statement', () => {
  const noise = 'import '.repeat(40000);
  const spaced = `import${' '.repeat(40000)}x`;
  const started = Date.now();
  assert.deepEqual(importSpecifiersOf(noise), []);
  assert.deepEqual(importClausesOf(noise), []);
  assert.deepEqual(importSpecifiersOf(spaced), []);
  assert.deepEqual(importClausesOf(`${noise}'x'`), []);
  assert.ok(Date.now() - started < 5000, 'a linear pass finishes in well under five seconds');
});
