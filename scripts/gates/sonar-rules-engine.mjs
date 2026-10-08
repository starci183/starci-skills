// sonar-rules-engine.mjs - lint source texts with the Sonar rule table (./sonar-rules-table.mjs) through ESLint's Node API and
// return findings {rule, file, line, column, message, text, weight}: `rule` is the Sonar id, `text` the source of the reported node
// (what the baseline fingerprints, so a finding survives a line shift), `weight` the number a message carries (cognitive complexity).
import { ESLint } from 'eslint';
import { sonarFlatConfig, sonarIdOf } from './sonar-rules-table.mjs';

const WEIGHT = /\bfrom (\d+) to\b/;

/** The offset of 1-based `line`/`column` in `source`. */
function offsetOf(lineStarts, line, column) {
  return (lineStarts[line - 1] ?? 0) + column - 1;
}

function lineStartsOf(source) {
  const starts = [0];
  for (let i = 0; i < source.length; i += 1) if (source.charCodeAt(i) === 10) starts.push(i + 1);
  return starts;
}

/** The source of the node a message points at, whitespace collapsed; empty when the message has no end position. */
function reportedText(source, starts, message) {
  const from = offsetOf(starts, message.line, message.column);
  const to = message.endLine ? offsetOf(starts, message.endLine, message.endColumn) : from;
  return source.slice(from, Math.max(to, from)).replaceAll(/\s+/g, ' ').trim();
}

const toFinding = (file, source, starts, message) => ({
  rule: sonarIdOf(message.ruleId),
  file,
  line: message.line,
  column: message.column,
  message: message.message,
  text: reportedText(source, starts, message) || (source.split('\n')[message.line - 1] ?? '').trim(),
  weight: Number(WEIGHT.exec(message.message)?.[1]) || undefined,
});

/** Lint `entries` ([{file, source}], posix paths relative to `root`); a syntax error is a finding of rule `PARSE`. */
export async function lintSources(root, entries) {
  const eslint = new ESLint({ cwd: root, overrideConfigFile: true, overrideConfig: sonarFlatConfig(), ignore: false });
  const results = await Promise.all(entries.map(({ file, source }) => eslint.lintText(source, { filePath: file })));
  return results.flatMap(([result], at) => {
    const { file, source } = entries[at];
    const starts = lineStartsOf(source);
    return result.messages.filter((message) => message.ruleId || message.fatal).map((message) => toFinding(file, source, starts, message.ruleId ? message : { ...message, ruleId: 'PARSE' }));
  });
}
