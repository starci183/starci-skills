#!/usr/bin/env node
// starci runtime revision-scope — what a deploy of the runtime tree asks of each role (modules/kernel/revision-scope.yaml): per role the action and a
// count, from one revision to another, before anything is deployed. The deploying lane journals the --json payload on its deploy event.
//   starci runtime revision-scope --from <sha> [--to <sha>] [--root <dir>] [--json]
import { isMain } from '../lib/is-main.mjs';
import { arg } from '../lib/cli-arg.mjs';
import { skillRoot } from '../../engine/runtime-root.mjs';
import { revParse } from '../api/git/rev-parse.mjs';
import { deployLine, deployRoles } from './revision-deploy.mjs';

/** The payload and the line of one scope query; `to` defaults to the HEAD of `root`. */
export function revisionScope({ root = skillRoot, from, to = null }) {
  const target = to ?? String(revParse(root, 'HEAD') ?? '').trim();
  const payload = deployRoles(root, from, target);
  return { payload, line: deployLine(payload) };
}

if (isMain(import.meta.url)) {
  const argv = process.argv.slice(2);
  const from = arg(argv, 'from');
  if (!from) {
    console.error('use: starci runtime revision-scope --from <sha> [--to <sha>] [--root <dir>] [--json]');
    process.exit(2);
  }
  const answer = revisionScope({ root: arg(argv, 'root') ?? skillRoot, from, to: arg(argv, 'to') });
  console.log(argv.includes('--json') ? JSON.stringify(answer.payload) : answer.line);
}
