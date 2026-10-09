import path from 'node:path';

/** The code a verb that writes the runtime tree is refused with when it would write a tree other than the CLI's own. */
export const RUNTIME_TREE_FOREIGN = 'RUNTIME_TREE_TARGET_FOREIGN';

const sameRoot = (a, b) => (process.platform === 'win32' ? path.resolve(a).toLowerCase() === path.resolve(b).toLowerCase() : path.resolve(a) === path.resolve(b));

/** Whether this invocation of `command` writes the runtime tree: its `writesRuntimeTree` is true (always), a flag name that makes it write, or `!flag` (writes unless that flag is given). */
function writesTree(command, args) {
  const mark = command?.writesRuntimeTree;
  if (mark === true) return true;
  if (typeof mark !== 'string') return false;
  return mark.startsWith('!') ? !args.includes(`--${mark.slice(1)}`) : args.includes(`--${mark}`);
}

/**
 * The refusal of a verb that writes the runtime tree while the located runtime is not the tree that owns the running CLI and nothing chose it
 * explicitly (STARCI_RUNTIME, or the verb's own --root). The per-user record outranks the checkout for reading, so a clone's bin would otherwise
 * write the live tree. Null when the verb does not write the tree, the CLI is not in a runtime, or the target is explicit or the CLI's own. Pure.
 */
export function treeTargetRefusal({ command, args, located, own }) {
  if (!located || !own || !writesTree(command, args)) return null;
  if (located.source === 'STARCI_RUNTIME' || args.includes('--root') || sameRoot(located.root, own)) return null;
  return { code: RUNTIME_TREE_FOREIGN, message: `${RUNTIME_TREE_FOREIGN}: this verb writes the runtime tree, and the located runtime ${located.root} (${located.source}) is not the tree ${own} that owns this CLI; set STARCI_RUNTIME=${own} (or pass --root) to say which tree to write` };
}
