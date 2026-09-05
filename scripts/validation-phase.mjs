import { AsyncLocalStorage } from 'node:async_hooks';

const phases = new AsyncLocalStorage();

export const currentRequestPhase = () => phases.getStore()?.requestPhase ?? 'predispatch';
export const withRequestPhase = (requestPhase, operation) => phases.run({ requestPhase }, operation);
