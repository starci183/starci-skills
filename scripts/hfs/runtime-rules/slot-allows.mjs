// slot-allows.mjs - the `allows` and `forbids` entries of the runtime slots (knowledge/hfs/runtime-slots.yaml), judged on
// every tracked file a slot owns: a slot that lists `allows` admits only its `requires` and `allows` entries, and no slot
// admits a file its `forbids` names. A refused file is HFS_FORBIDDEN_PRESENT (rule R01), the code of a file the tree
// forbids. The entries are read through scripts/hfs/allows.mjs, the reading the product machine checks share. Pure.
import { allowsFile, relativeToRoot } from '../allows.mjs';
import { braceVariants, globExpression } from '../../lib/glob.mjs';

export const CODE = 'HFS_FORBIDDEN_PRESENT';
const VAR = /<([A-Za-z][A-Za-z0-9-]*)>/g;

/** The `forbids` entry of `slot` that names `relative` (variables filled from `bindings`), or null. */
function forbiddenBy(slot, relative, bindings) {
  for (const entry of slot.forbids ?? []) {
    const directory = entry.endsWith('/');
    const filled = (directory ? entry.slice(0, -1) : entry).replace(VAR, (whole, name) => bindings[name] ?? '*');
    for (const variant of braceVariants(filled)) {
      const rx = globExpression(directory ? `${variant}/**` : variant);
      if (rx.test(relative) || rx.test(`${relative}/`)) return entry;
    }
  }
  return null;
}

/** HFS_FORBIDDEN_PRESENT for the tracked files their own slot's allows/forbids refuse. */
export function slotAllowsFindings(ctx) {
  const found = [];
  for (const file of ctx.files) {
    const c = ctx.resolver.classifyPath(file);
    if (c.status !== 'owned') continue;
    const slot = ctx.resolver.slot(c.slot);
    if (!slot.allows?.length && !slot.forbids?.length) continue;
    if (slot.allows?.length) {
      const verdict = allowsFile(ctx.resolver, file);
      if (verdict && !verdict.allowed) {
        const reason = verdict.forbiddenBy ? `: its forbids names ${verdict.forbiddenBy}` : `: it admits only ${[...(slot.requires ?? []), ...slot.allows].join(', ')}`;
        found.push({ code: CODE, level: 'error', path: file, slot: slot.id, message: `${file} is not admitted by ${slot.id} (${slot.path})${reason}` });
      }
      continue;
    }
    const entry = forbiddenBy(slot, relativeToRoot(c.path, c.root), c.bindings ?? {});
    if (entry) found.push({ code: CODE, level: 'error', path: file, slot: slot.id, message: `${file} is forbidden by ${slot.id} (${slot.path}): its forbids names ${entry}` });
  }
  return found;
}
