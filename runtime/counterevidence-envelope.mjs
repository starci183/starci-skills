const COMPLETION_COUNTEREVIDENCE = Symbol('starci.completion-counterevidence');

export function brandCompletionCounterevidence(envelope) {
  Object.defineProperty(envelope, COMPLETION_COUNTEREVIDENCE, { value: true });
  return Object.freeze(envelope);
}

export function isCompletionCounterevidenceEnvelope(value) {
  return value?.[COMPLETION_COUNTEREVIDENCE] === true;
}
