// managed-json.mjs - which JSON files are managed canon rather than authored JSON (knowledge/hfs/slots.yaml `managedBy` /
// `liteManagedBy`): a template of @starci/hfs that a managed slot names (templates/<scope or common>/<group>/<path, each leading dot
// dropped>), declared by the slot manifest and nowhere else, and an app's render of one, which `starci app sync` writes. Only a template
// with no `{{variable}}` is a render candidate, and only a file whose text equals that template (line endings aside) is its render:
// a file that differs in any byte stays authored.
import { braceVariants } from './glob.mjs';

const SIDES = Object.freeze(['be', 'fe']);
const lf = (text) => String(text).replace(/\r\n/g, '\n');
/** A literal file path of a slot (no wildcard or variable): only those are whole managed files. */
const literal = (file) => !/[*?[<]/.test(file);
const undotted = (file) => file.split('/').map((segment) => segment.replace(/^\./, '')).join('/');

/** The scope (app, be or fe) and scope-relative path of an app-relative path, one per profile a slot may hold it in. */
const placementsOf = (appRel) => [
  { scope: 'app', file: appRel },
  ...SIDES.filter((side) => appRel.startsWith(`${side}/`)).map((side) => ({ scope: side, file: appRel.slice(side.length + 1) })),
];

/**
 * The template names (relative to the @starci/hfs templates folder) a managed slot of `manifest` renders `appRel` from, in every
 * edition: [] when no managed slot lists that literal file.
 */
export function managedTemplatesOf(manifest, appRel) {
  const placements = placementsOf(appRel);
  const matches = managedFilesOf(manifest).filter((managed) => placements.some(({ scope, file }) => managed.scope === scope && managed.file === file));
  return [...new Set(matches.map((managed) => managed.name))];
}

/** Every literal file of every managed slot, with its scope and the template name it is rendered from: [{scope, file, name}]. */
function managedFilesOf(manifest) {
  return (manifest?.slots ?? []).flatMap((slot) => {
    const groups = [...new Set([slot.managedBy, slot.liteManagedBy].filter((group) => typeof group === 'string'))];
    const paths = [slot.path, slot.lite?.path].filter((value) => typeof value === 'string').flatMap(braceVariants).filter(literal);
    return (slot.profiles ?? []).flatMap((scope) => paths.flatMap((file) => groups.flatMap((group) =>
      [scope, 'common'].map((dir) => ({ scope, file, name: `${dir}/${group}/${undotted(file)}` })))));
  });
}

/**
 * Every template name a managed slot of `manifest` declares (its literal files in each profile, edition group and scope or common
 * folder): the canon source `starci app sync` renders from, which the slot manifest itself names, so a template is declared there and
 * nowhere else.
 */
export function declaredTemplateNames(manifest) {
  return new Set(managedFilesOf(manifest).map((managed) => managed.name));
}

/** Whether `text` is the render of one of `templates` ([{name, text}]): a template with no variable whose text equals it. */
export const isManagedRender = (text, templates) =>
  templates.some((template) => typeof template.text === 'string' && !template.text.includes('{{') && lf(template.text) === lf(text));
