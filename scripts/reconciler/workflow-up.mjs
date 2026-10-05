import { main as start } from './start.mjs';
import { isMain } from '../lib/is-main.mjs';

export async function main(argv = process.argv.slice(2), deps = {}) {
  return start(argv, { ...deps, workflowEntry: true });
}

if (isMain(import.meta.url)) await main();
