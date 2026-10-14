// Read executable CI run steps from unrendered, managed workflow templates.
import { parseYaml } from '../../../engine/yaml.mjs';

function yamlTemplate(text) {
  return String(text ?? '')
    .replace(/^[ \t]*\{\{(?:header|>[^{}\r\n]*)\}\}[ \t]*\r?$/gm, '')
    .replace(/\{\{[^{}\r\n]*\}\}/g, (match, offset, source) => source[offset - 1] === '$' ? match : 'template');
}

function disabled(condition) {
  return condition === false || /^(?:false|\$\{\{\s*false\s*\}\})$/.test(String(condition ?? '').trim());
}

/** Mustache partials outside scalars are omitted; GitHub expressions retain their conditions. */
export function workflowRunCommands(text) {
  let document;
  try { document = parseYaml(yamlTemplate(text)); } catch { return []; }
  const commands = [];
  for (const job of Object.values(document?.jobs ?? {})) {
    if (disabled(job?.if) || !Array.isArray(job?.steps)) continue;
    for (const step of job.steps) {
      if (typeof step?.run !== 'string' || disabled(step.if)) continue;
      commands.push(step.run);
    }
  }
  return commands;
}
