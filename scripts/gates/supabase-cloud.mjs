import { requestJson } from '../api/http/request-json.mjs';
import { cloudActions } from '../api/supabase/cloud-actions.mjs';
import { supabaseCloudSpec, SUPABASE_MANAGEMENT_ORIGIN } from '../lib/supabase-cloud-spec.mjs';
import { supabaseRefusal, supabaseResultCodes } from '../lib/supabase-contract.mjs';
import { resolveProvisionTarget } from './provision-target.mjs';
import { runProvisionOperation, sealProvisionValues } from './provision-operation.mjs';
import { withProvisionCredentials } from './provision-custody.mjs';

/** Plan or execute a declared Supabase Cloud task; authority admission precedes private custody and provider calls. */
export async function runSupabaseCloud(ctx) {
  const action = ctx?.positionals?.[0];
  let target;
  try { target = await resolveProvisionTarget({ cwd: ctx.cwd, targetId: ctx.args?.target, provider: 'supabase-cloud' }); }
  catch { return supabaseRefusal('supabase-target-unavailable'); }
  const spec = supabaseCloudSpec(action, target);
  if (!spec.ok) return supabaseRefusal(spec.code);
  const credentialRoles = ctx.operationPolicy?.credentials;
  if (!Array.isArray(credentialRoles)) return supabaseRefusal('supabase-action-policy-unavailable');
  const credentialRefs = Object.fromEntries(credentialRoles.map((role) => [role, target.credentials?.[role]]));
  const privateRun = async ({ credentials, checkpoint, acknowledge }, reconcile) => cloudActions(spec, {
    credentials, checkpoint, acknowledge, reconcile,
    request: (request) => requestJson(request, { allowedOrigins: [SUPABASE_MANAGEMENT_ORIGIN] }),
    seal: (value) => sealProvisionValues(target.destination, value, { env: ctx.env, repoRoot: target.repoRoot }),
    compareDestination: (value) => withProvisionCredentials({ destination: target.destination },
      { env: ctx.env, repoRoot: target.repoRoot }, (privateValues) => privateValues.destination === value),
  });
  return runProvisionOperation(ctx, {
    action: `supabase.cloud.${action}`, target, requestId: ctx.args?.operation,
    execute: ctx.args?.execute === true, credentialRefs,
    destination: action === 'keys-capture' ? target.destination : null,
    publicResource: { action, projectRef: spec.projectRef ?? null, configuration: spec.config },
    resultCodes: supabaseResultCodes,
    plan: { ...spec.plan, credentialRoles },
    apply: (privateContext) => privateRun(privateContext, false),
    reconcile: (privateContext) => privateRun(privateContext, true),
  });
}
