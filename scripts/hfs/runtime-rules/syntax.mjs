// syntax.mjs - RT_SYNTAX_INVALID (knowledge/hfs/rules.yaml, gate runtime): every tracked JavaScript source parses.
// The runtime's Node-exact check still judges its executable folders; this rule extends syntax coverage to tests,
// packages and every other tracked .mjs/.cjs/.js file. Generated roots and vendored build trees are not authored source.
// The TypeScript compiler parses the batch in-process: no child process is started per file. Pure apart from ctx.read.
import { ts } from './source-ast.mjs';

export const CODE = 'RT_SYNTAX_INVALID';
const JAVASCRIPT = /\.(?:mjs|cjs|js)$/;
// A managed template carries render tokens ({{name}}) that are not JavaScript until `hfs sync` renders them: not authored source.
const TEMPLATE_TREE = /^packages\/hfs\/templates\//;
const RENDER_TOKEN = /\{\{[A-Za-z][A-Za-z0-9.]*\}\}/;
const VENDORED_BUILD = /(?:^|\/)(?:node_modules|dist|reference-renders)\//;

/** The tracked JavaScript paths in scope, with generated roots and vendored build trees excluded. */
export function syntaxSourceFiles(files, params) {
  const generated = (params.generated ?? []).map((entry) => `${String(entry.root).replace(/\/+$/, '')}/`);
  return files.filter((file) => JAVASCRIPT.test(file)
    && !VENDORED_BUILD.test(file)
    && !generated.some((root) => file.startsWith(root)));
}

/** RT_SYNTAX_INVALID over every tracked JavaScript file of the runtime, one finding per parser diagnostic. */
export function syntaxFindings(ctx) {
  const compiler = ts();
  const found = [];
  for (const file of syntaxSourceFiles(ctx.files, ctx.params)) {
    const text = ctx.read(file);
    if (text === null || text === undefined) continue;
    if (TEMPLATE_TREE.test(file) && RENDER_TOKEN.test(text)) continue;
    const kind = file.endsWith('.mjs') ? (compiler.ScriptKind.MJS ?? compiler.ScriptKind.JS) : compiler.ScriptKind.JS;
    const source = compiler.createSourceFile(file, text, compiler.ScriptTarget.Latest, true, kind);
    for (const diagnostic of source.parseDiagnostics) {
      const position = Math.min(diagnostic.start ?? 0, text.length);
      const line = source.getLineAndCharacterOfPosition(position).line + 1;
      const detail = compiler.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
      found.push({ code: CODE, level: 'error', path: file, line, message: `${file}:${line} has invalid JavaScript syntax: ${detail}` });
    }
  }
  return found;
}
