import { validatorFor, runValidatorCli } from '../../validation.mjs';

const semantic = (value) => {
  const errors = [];
  const { authority, observedState } = value.context;
  const requested = value.input.requestedIngress;
  for (const [name, resource] of [['tunnel', observedState.tunnel], ['dns', observedState.dns], ['route', observedState.route]]) {
    if (resource && resource.owner !== authority.owner) errors.push(`/context/observedState/${name}/owner: conflicts with declared authority`);
  }
  if (observedState.tunnel && observedState.tunnel.tunnelId !== requested.tunnelId) errors.push('/context/observedState/tunnel/tunnelId: exceeds requested tunnel');
  if (observedState.dns && observedState.dns.hostname !== requested.hostname) errors.push('/context/observedState/dns/hostname: exceeds requested hostname');
  if (observedState.route && observedState.route.hostname !== requested.hostname) errors.push('/context/observedState/route/hostname: exceeds requested hostname');
  return errors;
};

export const validateInput = validatorFor(new URL('./input.schema.json', import.meta.url), semantic);

if (process.argv[1]?.endsWith('validate-input.mjs')) await runValidatorCli(validateInput, 'node validate-input.mjs <input.json>');
