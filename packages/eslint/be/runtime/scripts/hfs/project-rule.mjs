// project-rule.mjs - the factory of the lint rules that read the project graph (scripts/hfs/project-graph.mjs).
//
// A project rule judges nothing itself: the graph (the architecture machine's module graph and slot manifest, built once per
// process) holds the findings of its codes, and the rule reports those of the file it is visiting, on the line the machine named.
// `settings.starci.injectedTypeScript` is a fixtures-only seam, a function returning the compiler (RuleTester freezes settings, and a frozen compiler cannot run).
// Both lint canons ship a byte copy of this file in runtime/ and build their rules with it.
import path from 'node:path';
import { projectGraph } from './project-graph.mjs';
import { posixPath } from '../lib/path-key.mjs';
import { belongsTo, codeOf } from './architecture/surface.mjs';

/**
 * A rule reporting the graph findings of `codes` on the linted file.
 *
 * @param {{ enforcer: object, runtimeRoot: string, hfsOf: (context: object) => object }} input - `enforcer` is a row of LINT_ENFORCERS (id, codes, description, origin, via)
 * @returns {object} An ESLint rule.
 */
export const projectRule = ({ enforcer, runtimeRoot, hfsOf }) => {
  return {
    meta: { type: 'problem', docs: { description: enforcer.description }, schema: [], messages: { finding: '{{message}}' } },
    create(context) {
      const hfs = hfsOf(context);
      const rel = posixPath(path.relative(hfs.repoRoot, context.filename));
      if (rel.startsWith('..')) return {};
      const { byFile } = projectGraph({ repoRoot: hfs.repoRoot, runtimeRoot, injectedTypeScript: context.settings?.starci?.injectedTypeScript?.() });
      const mine = (byFile.get(rel) ?? []).filter((finding) => belongsTo(enforcer, finding));
      return {
        Program(node) {
          for (const finding of mine) {
            const line = Number.isInteger(finding.line) && finding.line >= 1 ? finding.line : 1;
            // the machine counts columns from 1, ESLint from 0
            const column = Number.isInteger(finding.column) && finding.column >= 1 ? finding.column - 1 : 0;
            context.report({ node, loc: { start: { line, column } }, messageId: 'finding', data: { message: `[${codeOf(finding)}] ${finding.message}` } });
          }
        },
      };
    },
  };
};
