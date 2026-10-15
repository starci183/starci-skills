// Read executable CI run steps from unrendered, managed workflow templates.
import { parseYaml } from '../../../engine/yaml.mjs';
import { ciWorkflowCommands } from '../../../packages/hfs/sync/ci-commands.mjs';

function yamlTemplate(text, bindings) {
  return String(text ?? '')
    .replace(/^[ \t]*\{\{(?:header|>[^{}\r\n]*)\}\}[ \t]*\r?$/gm, '')
    .replace(/\{\{([^{}\r\n]*)\}\}/g, (match, name, offset, source) => {
      if (source[offset - 1] === '$') return match;
      if (Object.hasOwn(bindings, name) && typeof bindings[name] === 'string') return bindings[name];
      return 'template';
    });
}

function disabled(condition) {
  return condition === false || /^(?:false|\$\{\{\s*false\s*\}\})$/.test(String(condition ?? '').trim());
}

/** Resolve scalar commands with sync's ordinary-app bindings; unknown variables prove no command.
 * Mustache partials outside scalars are omitted; GitHub expressions retain their conditions. */
export function workflowRunCommands(text, bindings = ciWorkflowCommands()) {
  let document;
  try { document = parseYaml(yamlTemplate(text, bindings)); } catch { return []; }
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
