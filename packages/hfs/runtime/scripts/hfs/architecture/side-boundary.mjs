// side-boundary.mjs - what counts as an import that leaves a side of an app (ARCH_INTERNAL_IMPORT_OUTSIDE).
// A side (be/ or fe/) imports nothing of the app outside itself: the root holds no source and the other side is another program; a
// declared read of the OTHER side (be/contracts/) is codegen input, never an import. A declared read of a tree the APP ROOT owns
// (supabase/types/, sides.<side>.reads of the slot manifest) is the one thing both sides do import: the generated database types.
import path from 'node:path';
import { isInside, slash } from './config.mjs';

const OTHER_SIDE = /^(be|fe)\//;

/** True when `target` (an absolute path) lies in a tree of the app root that the side declares it reads (`reads` of the side declaration). */
const readsAppTree = (config, target) => (config.hfs?.repo?.reads ?? [])
  .some((read) => !OTHER_SIDE.test(read) && isInside(path.join(config.packageRoot, read), target));

/** Whether an import of `target` leaves the side the machine judges (config.root) for the app (config.packageRoot), declared app-root reads excepted. */
export const crossesSide = (config, target) => config.packageRoot !== undefined && config.packageRoot !== config.root
  && isInside(config.packageRoot, target) && !isInside(config.root, target) && !slash(target).includes('/node_modules/') && !readsAppTree(config, target);
