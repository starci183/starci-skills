// The parts the Kernel menu and the Supervisor menu share: a template filled from an item's subject, the escape option every
// item carries, and the plain words of a starci call a seat table is read by.

/** `template` with each `{key}` replaced by the subject's value; a key the subject does not know stays as written. */
export const fillTemplate = (template, subject) => String(template ?? '').replace(/\{(\w+)\}/g, (match, key) => (subject[key] == null ? match : String(subject[key])));

/** The escape option of a menu catalog (`escape: {choice, effect}`): no step, a reason as its text. */
export const escapeOptionOf = (escape, extra = {}) => ({ choice: escape.choice, ...extra, steps: [], effect: escape.effect, text: 'reason', escape: true });

/** The first `count` words of an argument list that are not options. */
export const plainWords = (args, count) => args.filter((value) => !String(value).startsWith('-')).slice(0, count).map(String);
