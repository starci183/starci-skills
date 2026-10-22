import type { Concept } from '../concept';

/** Names the C8 evidence concept this module belongs to, for the renderer registry that picks a view per evidence file kind. */
export const concept: Concept = 'C8';

/** S7 renderers. Text comes already decoded (server converts UTF-16/BOM to UTF-8). Implementations live in ./renderers/. */
export { JsonView } from './renderers/json-view';
export { YamlView } from './renderers/yaml-view';
export { MarkdownView } from './renderers/markdown-view';
export { TextView } from './renderers/text-view';
export { DiffTextView } from './renderers/diff-view';
export { ImageView, VideoView } from './renderers/media';
