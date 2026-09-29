import type { Concept } from '../concept';

export const concept: Concept = 'C8';

/** S7 renderers. Text comes already decoded (server converts UTF-16/BOM to UTF-8). Implementations live in ./renderers/. */
export { JsonView } from './renderers/json-view';
export { YamlView } from './renderers/yaml-view';
export { MarkdownView } from './renderers/markdown-view';
export { TextView } from './renderers/text-view';
export { DiffTextView } from './renderers/diff-view';
export { ImageView, VideoView } from './renderers/media';
