// op-prompt-capabilities.mjs — the prompt lines of the capability verbs the runtime performs for an op: a generated image
// (op-prompt-imagegen.mjs) and a served-app render (op-prompt-render.mjs). Each module tells only the ops its policy table names.
import { imagegenPromptLines } from './op-prompt-imagegen.mjs';
import { renderPromptLines } from './op-prompt-render.mjs';

/** Every capability line for `op`, in the order the prompt lists them. */
export const capabilityPromptLines = ({ skillRoot, op }) => [...imagegenPromptLines({ skillRoot, op }), ...renderPromptLines({ skillRoot, op })];
