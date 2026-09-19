import {ensureBuild} from './ensure-build.mjs';
import {readDistJson} from '../core/runtime-root.mjs';
await ensureBuild();
const data=readDistJson('docs','catalog.json');
process.stdout.write(JSON.stringify({ok:true,operators:data.operators.length,workflows:data.workflows.length})+'\n');
