import { runValidatorCli, validatorFor } from '../../validation.mjs';

const schemaUrl = new URL('./output.schema.json', import.meta.url);
const routes = {
  "ready": {
    "stage": "workspace.bootstrap",
    "status": "ready",
    "fact": "workspace-identity-ready",
    "state": "completed",
    "code": "workspace-identity-verify-ready"
  },
  "initialize-required": {
    "stage": "workspace.initialization", "status": "ready", "fact": "workspace-identity-initialize-required",
    "state": "replan", "code": "workspace-identity-verify-initialize-required"
  },
  "blocked": {
    "stage": "workspace.blocked", "status": "blocked", "fact": "workspace-identity-blocked",
    "state": "blocked", "code": "workspace-identity-verify-blocked"
  }
};

function semantic(value) {
  const errors = [];
  const route = routes[value.payload.decision];
  if (!route) return ['/payload/decision: undeclared decision'];
  if (value.stage !== route.stage || value.status !== route.status) errors.push('/stage: decision does not match emitted route');
  if (value.payload.state.status !== route.state || value.payload.state.code !== route.code) errors.push('/payload/state: status or code does not match decision');
  if (value.payload.state.emits.stage !== value.stage || value.payload.state.emits.status !== value.status) errors.push('/payload/state/emits: must match root route');
  if (!value.facts.includes(route.fact) || !value.payload.state.emits.factsAdd.includes(route.fact)) errors.push(`/facts: missing emitted fact ${route.fact}`);
  if (value.payload.decision === 'ready' && value.payload.produced.identityReceiptRef === null) errors.push('/payload/produced/identityReceiptRef: ready output requires a session artifact');
  if (value.payload.decision !== 'ready' && value.payload.produced.identityReceiptRef !== null) errors.push('/payload/produced/identityReceiptRef: non-ready output cannot claim a readiness receipt');
  if (value.payload.produced.durableWrites.length !== 0) errors.push('/payload/produced/durableWrites: read-only operator cannot report durable writes');
  if (value.payload.cleanup.retention !== 'until-skill-terminal' || value.payload.cleanup.purgeAt !== 'skill-terminal') errors.push('/payload/cleanup: terminal purge is mandatory');
  return errors;
}

export const validateOutput = validatorFor(schemaUrl, semantic);

if (process.argv[1] && import.meta.url === new URL(`file:///${process.argv[1].replaceAll('\\\\', '/')}`).href) {
  await runValidatorCli(validateOutput, 'usage: node validate-output.mjs <output.json>');
}
