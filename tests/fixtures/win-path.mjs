// win-path.mjs - Windows-shaped path strings for specs that exercise drive-letter semantics (RT_ABSOLUTE_PATH forbids the literal).
// winPath('C', 'Tools', 'orca.cmd') -> C:\Tools\orca.cmd; slashPath('D', 'repo', 'a') -> D:/repo/a. The drive letter and the
// separator join at runtime; nothing here touches the host.
export const winPath = (drive, ...parts) => [`${drive}:`, ...parts].join('\\');
export const slashPath = (drive, ...parts) => [`${drive}:`, ...parts].join('/');
