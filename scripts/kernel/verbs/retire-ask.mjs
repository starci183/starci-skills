// api retire-ask — close an ask the owner should no longer answer (api-lib/asks.mjs retireAsk):
// the ask is recorded ask-superseded with by:null and the reason, the same terminal kind
// serve-ask writes for a replaced ask; its Telegram messages leave the owner's chat. Split out
// of api.mjs (lane slim-api); its help line stays in api.mjs usage() (usageInCore).
//
//   retire-ask --workflow <id> --dispatch <id> --reason <text>
import { retireAsk } from './shared/asks.mjs';

export default {
  verb: 'retire-ask',
  required: ['workflow', 'dispatch', 'reason'],
  kernelOnly: true,
  usageInCore: true,
  usage: '  retire-ask --workflow <id> --dispatch <id> --reason <text>   close an ask the owner should no longer answer (ask-superseded)',
  async run({ ledger, args, repo, emit }) {
    const out = await retireAsk(ledger, { workflowId: args.workflow, dispatchId: args.dispatch, reason: args.reason, repo });
    emit(out, out.retired ? `retired ask ${out.dispatchId}: ${out.reason}` : `retire-ask ${out.dispatchId}: already ${out.already}`, args.json);
  },
};
