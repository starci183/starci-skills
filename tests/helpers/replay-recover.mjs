// replay-recover.mjs - the Kernel start's launch recovery (scripts/kernel/workflow-launch-custody.mjs recoverWorkflowLaunch) run in a fresh process over a replay world,
// so it reads Orca through the stub the world names (the Orca command is read once per process). Argument: JSON {ledgerFile, workflowId}. Prints the recovery result as JSON.
import { openLedger } from '../../engine/db/ledger.mjs';
import { recoverWorkflowLaunch } from '../../scripts/kernel/workflow-launch-custody.mjs';

const { ledgerFile, workflowId } = JSON.parse(process.argv[2]);
const ledger = openLedger({ file: ledgerFile });
try {
  const signal = ledger.db.prepare("SELECT * FROM signals WHERE scope='kernel' AND key=?").get(workflowId);
  process.stdout.write(`${JSON.stringify(recoverWorkflowLaunch(ledger, { workflowId, signal, env: process.env }))}\n`);
} finally { ledger.close(); }
