const normalize = (value) => value
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('en')
  .replace(/\s+/g, ' ')
  .trim();

/** Resolve only an explicitly requested browser host; ambient UI state is never input authority. */
export const resolveBrowserSurface = (request, options = {}) => {
  if (typeof request !== 'string') throw new TypeError('browser surface request must be a string');
  if (options === null || typeof options !== 'object') throw new TypeError('browser surface options must be an object');
  const text = normalize(request);
  const inSession = /\b(trong phien nay|o trong nay|side panel|panel ben|in-app browser|browser trong phien)\b/.test(text);
  if (inSession) return 'in-app';
  const externalChrome = /\b(chrome|google chrome|chrome extension|browser ngoai|trinh duyet ngoai|tab chrome)\b/.test(text);
  if (externalChrome) return 'external-chrome';
  return options.uiWork === true ? 'in-app' : 'unspecified';
};
