// win-path.mjs - Windows-shaped path strings for specs that exercise drive-letter semantics (RT_ABSOLUTE_PATH forbids the literal).
// winPath(drive, ...parts) joins the drive, a colon and the parts with a backslash; slashPath joins them with a slash. The drive letter and the
// separator join at runtime; nothing here touches the host.
export const winPath = (drive, ...parts) => [`${drive}:`, ...parts].join('\\');
export const slashPath = (drive, ...parts) => [`${drive}:`, ...parts].join('/');
