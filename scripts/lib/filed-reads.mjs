// filed-reads.mjs - the one rule of an op's READ set (pure): which Source refs its filed READ requires a READ digest to name.
// `starci gate read` generates the digest from it inside the op (scripts/cli/gate-read.mjs), judgeFiledRead verifies it at settle
// (scripts/kernel/mechanism-observation.mjs), the op prompt states it.
import { lines } from './verb-call.mjs';
import { EXAMPLE_CATALOG_FILE } from './example-refs.mjs';

/** Declared READ references split on newline and `+`. */
export const READ_SEPARATOR = /[+\n]/;

/**
 * The Source refs a filed READ requires: every knowledge/ ref, the declared law inputs of the `standard` read (the example
 * catalog, docs/*.md) and every ref filed for a declared example catalog read. `readRefs` are the admitted refs, `reads` the
 * selected contract's declared reads.
 */
export function filedRequiredReads(readRefs, reads) {
  const tokens = (row) => lines(row.path, { separator: READ_SEPARATOR });
  const lawInputs = new Set(reads.filter((row) => row.id === 'standard').flatMap(tokens)
    .filter((token) => token === EXAMPLE_CATALOG_FILE || (/^docs\/[^*?<>\:]+\.md$/.test(token) && !token.split('/').includes('..'))));
  const provenance = reads.filter((row) => tokens(row).includes(EXAMPLE_CATALOG_FILE)).map((row) => `brief read [${row.id ?? '?'}] — `);
  return new Set(readRefs.filter((row) => row.rootKind === 'source' && (row.path.startsWith('knowledge/') || lawInputs.has(row.path)
    || provenance.some((prefix) => row.why?.split('\n').some((why) => why.startsWith(prefix))))).map((row) => row.path));
}
