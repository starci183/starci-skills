import { generate } from '../ops/generate.mjs';
import { build } from './build-workflows.mjs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
export function ensureBuild() {
  let stale = generate({check:true}).length > 0;
  if (!stale) { try { stale = !build({check:true}).ok; } catch { stale = true; } }
  if (!stale) return {ok:true, rebuilt:false};
  generate();
  const result=build();
  if (!result.ok || !build({check:true}).ok) throw Error('Build verification failed; do not consume stale contracts.');
  return {...result, rebuilt:true};
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
  try {process.stdout.write(JSON.stringify(ensureBuild())+'\n');}
  catch(error){process.stderr.write(error.message+'\n');process.exitCode=1;}
}
