import { AsyncLocalStorage } from 'node:async_hooks';

const phases = new AsyncLocalStorage();

export const currentRequestPhase = () => phases.getStore()?.requestPhase ?? 'predispatch';
export const withRequestPhase = (requestPhase, operation) => phases.run({ ...phases.getStore(), requestPhase }, operation);
export const currentEvidenceOrigin = () => phases.getStore()?.evidenceOrigin ?? false;
export const withEvidenceOrigin = (evidenceOrigin, operation) => phases.run({ ...phases.getStore(), evidenceOrigin }, operation);
