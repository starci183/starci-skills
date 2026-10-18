import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import ts from 'typescript';
import { unusedSymbolFindings } from '../runtime/scripts/hfs/rules/unused-symbol.mjs';

function findings(t, edition, sources, catalog) {
  const repoRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'hfs-catalog-flow-'));
  t.after(() => fs.rmSync(repoRoot, { recursive: true, force: true }));
  const contents = { ...sources, 'fe/src/messages/en.json': JSON.stringify(catalog) };
  for (const [file, text] of Object.entries(contents)) {
    fs.mkdirSync(path.dirname(path.join(repoRoot, file)), { recursive: true });
    fs.writeFileSync(path.join(repoRoot, file), text);
  }
  return unusedSymbolFindings({ repoRoot, files: Object.keys(contents), repo: { edition }, ts }).map(item => item.name).sort();
}

for (const edition of ['full', 'lite']) {
  test(`${edition} follows shorthand translators through destructured factory parameters`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/factory.ts': `
        export const createActions = ({ tw, meta: { tm } }) => {
          tw('editSaved'); tm('pickPick');
        };
      `,
      'fe/src/view.ts': `
        import { createActions } from './factory';
        const tw = useTranslations('wizard');
        const tm = useTranslations('metadata');
        createActions({ tw, meta: { tm } });
      `,
    }, {
      wizard: { editSaved: 'Saved', unused: 'Unused', pickPick: 'Wrong namespace' },
      metadata: { pickPick: 'Pick', unused: 'Unused', editSaved: 'Wrong namespace' },
    }), ['metadata.editSaved', 'metadata.unused', 'wizard.pickPick', 'wizard.unused']);
  });

  test(`${edition} reads bounded dynamic key tails through handed-in translators and key variables`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/view.ts': `
        export function row(t: (key: string) => string, stage: string, error: string, key: string) {
          t(\`stage_\${stage}\`);
          const reasonKey = error === null ? null : \`err_\${error}\`;
          t(reasonKey);
          t(\`\${key}\`);
        }
        export function unrelated(format: (key: string) => number, stage: string) {
          format(\`other_\${stage}\`);
        }
      `,
    }, { workbench: { stage_new: 'New', stage_done: 'Done', err_failed: 'Failed', unused: 'Unused', other_new: 'Unused' } }),
    ['workbench.other_new', 'workbench.unused']);
  });

  test(`${edition} follows translator forwarding properties returned through a memoized hook`, t => {
    assert.deepEqual(findings(t, edition, {
      'fe/src/words.ts': `
        export const useWords = () => {
          const g = useTranslations('governance');
          return useMemo(() => ({ g: (key, values) => g(key, values) }), [g]);
        };
      `,
      'fe/src/view.ts': `
        import { useWords } from './words';
        const words = useWords();
        render(words);
        function render(words, reason: string) { words.g(\`reasonHint_\${reason}\`); }
      `,
    }, {
      governance: { reasonHint_routine: 'Routine', reasonHint_missing: 'Missing', unused: 'Unused' },
      unrelated: { reasonHint_routine: 'Unused' },
    }), ['governance.unused', 'unrelated.reasonHint_routine']);
  });
}
