export function measurePage({ generic, exemptSelector, layoutAttr = 'data-draw-layout' }) {
  const faces = [...document.fonts].map((face) => ({ family: face.family.replace(/^(["'])(.*)\1$/, '$2'), weight: face.weight, style: face.style, status: face.status }));
  const fontData = measureFonts(generic);
  const de = document.documentElement;
  const pageWidth = de.clientWidth;
  const scrollWidth = Math.max(de.scrollWidth, document.body?.scrollWidth ?? 0);
  const overflowing = measureOverflow(pageWidth, scrollWidth);
  const root = document.getElementById('root');
  const accentExempt = measureAccentExempt();
  const artwork = measureArtwork();
  const anatomy = measureAnatomy();
  const { ownership, dom } = measureOwnership(root, layoutAttr);
  return { ownership, dom, anatomy, accentExempt, artwork, faces, stacks: [...fontData.stacks], local: fontData.local, pageWidth, innerWidth, scrollWidth, overflowing, documentHeight: de.scrollHeight,
    rendered: document.documentElement.dataset.drawHarness === 'component' ? Boolean(root && root.childElementCount) : null };

  function visible(el) {
    const style = getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
  }

  function measureFonts(genericFamilies) {
    const stacks = new Set();
    const walker = document.createTreeWalker(document.body ?? document.documentElement, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      const el = node.parentElement;
      if (el && node.textContent.trim() && !['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE'].includes(el.tagName) && visible(el)) { stacks.add(getComputedStyle(el).fontFamily); }
    }
    for (const el of document.querySelectorAll('input,textarea,select,button')) {
      if (visible(el)) { stacks.add(getComputedStyle(el).fontFamily); }
    }
    const ctx = document.createElement('canvas').getContext('2d');
    const sample = 'mmmmmmmmmmlli10WQ@#';
    const width = (font) => { ctx.font = `72px ${font}`; return ctx.measureText(sample).width; };
    const families = new Set([...stacks].flatMap((stack) => stack.split(',').map((family) => family.trim().replace(/^(["'])(.*)\1$/, '$2'))).filter((family) => family && !genericFamilies.includes(family.toLowerCase())));
    const local = [...families].filter((family) => ['monospace', 'serif', 'sans-serif'].some((base) => width(`"${family}", ${base}`) !== width(base)));
    return { stacks, local };
  }

  function measureOverflow(width, scroll) {
    if (scroll > width) {
      return [...document.querySelectorAll('body *')].filter((el) => el.getBoundingClientRect().right > width + 0.5)
        .slice(0, 10).map((el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '') + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''));
    }
    return [];
  }

  function measureAccentExempt() {
    try {
      return [...document.querySelectorAll(exemptSelector)].map((el) => el.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0).map((rect) => ({ x: rect.left + scrollX, y: rect.top + scrollY, width: rect.width, height: rect.height }));
    } catch { return []; }
  }

  function measureArtwork() {
    try {
      return [...document.querySelectorAll('img')].filter((el) => visible(el) && (el.currentSrc || el.src)).map((el) => {
        const rect = el.getBoundingClientRect();
        let x0 = rect.left, y0 = rect.top, x1 = rect.right, y1 = rect.bottom;
        for (let ancestor = el.parentElement; ancestor; ancestor = ancestor.parentElement) {
          const style = getComputedStyle(ancestor);
          if (style.overflowX !== 'visible' || style.overflowY !== 'visible') {
            const clip = ancestor.getBoundingClientRect();
            x0 = Math.max(x0, clip.left); y0 = Math.max(y0, clip.top); x1 = Math.min(x1, clip.right); y1 = Math.min(y1, clip.bottom);
          }
        }
        return { src: el.currentSrc || el.src, slot: el.closest('[data-artwork-slot]')?.getAttribute('data-artwork-slot') ?? null,
          x: x0 + scrollX, y: y0 + scrollY, width: Math.max(0, x1 - x0), height: Math.max(0, y1 - y0) };
      }).filter((art) => art.width > 0 && art.height > 0);
    } catch { return []; }
  }

  function measureAnatomy() {
    const anatomy = { alerts: [], meters: [] };
    try {
      const tag = (el) => el.tagName.toLowerCase() + (el.id ? '#' + el.id : '');
      const partIn = (rootEl, names) => [...rootEl.querySelectorAll('[data-grammar-part]')].find((part) => names.includes(part.getAttribute('data-grammar-part').trim()));
      const probe = document.createElement('div');
      probe.style.cssText = 'position:absolute;visibility:hidden;background-color:var(--surface)';
      document.body.appendChild(probe);
      const surface = getComputedStyle(probe).backgroundColor;
      probe.remove();
      for (const el of document.querySelectorAll('[data-grammar-component="Alert"],[data-component="Alert"]')) {
        const alert = measureAlert(el, surface, tag, partIn);
        if (alert) { anatomy.alerts.push(alert); }
      }
      for (const el of document.querySelectorAll('[data-grammar-component="Meter"],[data-component="Meter"]')) {
        const meter = measureMeter(el, tag, partIn);
        if (meter) { anatomy.meters.push(meter); }
      }
    } catch { /* the anatomy is advisory measurement; the static gate still runs */ }
    return anatomy;
  }

  function measureAlert(el, surface, tag, partIn) {
    if (el.hasAttribute('data-grammar-part')) { return null; }
    const indicator = partIn(el, ['alert-indicator', 'indicator']) ?? el.querySelector('.alert__indicator');
    const title = partIn(el, ['alert-title', 'title']) ?? el.querySelector('.alert__title');
    const box = indicator?.getBoundingClientRect();
    return { desc: tag(el), background: getComputedStyle(el).backgroundColor, surface,
      indicator: box ? { width: box.width, height: box.height } : null, tile: Boolean(el.querySelector('[data-grammar-component="IconTile"],[data-component="IconTile"]')),
      indicatorColor: indicator ? getComputedStyle(indicator.querySelector('svg') ?? indicator).color : null, titleColor: title ? getComputedStyle(title).color : null };
  }

  function measureMeter(el, tag, partIn) {
    if (el.hasAttribute('data-grammar-part')) { return null; }
    const track = partIn(el, ['meter-track', 'track']) ?? el.querySelector('.meter__track');
    const band = el.parentElement;
    if (!track || !band) { return null; }
    const style = getComputedStyle(band);
    const trackRect = track.getBoundingClientRect();
    const segments = [...el.querySelectorAll('[data-grammar-part*="segment"]:not([data-grammar-part$="segments"]), .starci-core-meter-segment, [data-grammar-meter-segment]')]
      .map((part) => part.getBoundingClientRect()).map((rect) => ({ x: rect.left, width: rect.width }));
    const segmented = el.hasAttribute('data-grammar-meter-segments') || el.hasAttribute('data-segments') || segments.length > 1;
    return { desc: tag(el), segmented, track: { width: trackRect.width, height: trackRect.height },
      band: { width: band.clientWidth - Number.parseFloat(style.paddingLeft || '0') - Number.parseFloat(style.paddingRight || '0') }, segments };
  }

  function measureOwnership(rootEl, layoutAttribute) {
    let ownership = null, dom = null;
    if (document.documentElement.dataset.drawHarness !== 'component' || !rootEl) { return { ownership, dom }; }
    const marked = (el) => el.hasAttribute('data-component') || [...el.attributes].some((attr) => attr.name.startsWith('data-grammar-')) || [...el.classList].some((name) => name.startsWith('starci-core-'));
    const paints = (el) => {
      const style = getComputedStyle(el);
      if (style.display === 'none' || style.visibility === 'hidden') { return false; }
      if (['img', 'svg', 'canvas', 'video', 'picture'].includes(el.tagName.toLowerCase())) { return true; }
      if ([...el.childNodes].some((node) => node.nodeType === 3 && node.textContent.trim())) { return true; }
      if (style.backgroundColor && !/^(?:transparent|rgba\(0, 0, 0, 0\))$/.test(style.backgroundColor)) { return true; }
      if (style.backgroundImage && style.backgroundImage !== 'none') { return true; }
      if (['Top', 'Right', 'Bottom', 'Left'].some((side) => Number.parseFloat(style[`border${side}Width`]) > 0 && style[`border${side}Style`] !== 'none' && !/rgba\(0, 0, 0, 0\)/.test(style[`border${side}Color`]))) { return true; }
      return Boolean(style.boxShadow && style.boxShadow !== 'none');
    };
    const components = new Set();
    const unowned = [];
    let layoutElements = 0;
    for (const el of rootEl.querySelectorAll('*')) {
      if (el.hasAttribute('data-component')) { components.add(el.getAttribute('data-component')); }
      if (el.hasAttribute(layoutAttribute)) { layoutElements += 1; }
      if (el.closest('svg') && el.tagName.toLowerCase() !== 'svg') { continue; }
      if (!paints(el)) { continue; }
      const owner = ownerOf(el, rootEl, layoutAttribute, marked);
      if (owner !== 'grammar') { unowned.push(ownershipLabel(el, owner)); }
    }
    ownership = { components: [...components].sort((left, right) => { if (left < right) { return -1; } if (left > right) { return 1; } return 0; }), layoutElements, unownedCount: unowned.length, unowned: unowned.slice(0, 20) };
    const clone = document.documentElement.cloneNode(true);
    for (const el of clone.querySelectorAll('[data-component]')) {
      if (!el.hasAttribute('data-grammar-component')) { el.setAttribute('data-grammar-component', el.getAttribute('data-component')); }
    }
    for (const el of clone.querySelectorAll('script')) { el.remove(); }
    dom = `<!doctype html>
${clone.outerHTML}`;
    return { ownership, dom };
  }

  function ownerOf(el, rootEl, layoutAttribute, marked) {
    for (let ancestor = el; ancestor && ancestor !== rootEl; ancestor = ancestor.parentElement) {
      if (marked(ancestor)) { return 'grammar'; }
      if (ancestor.hasAttribute(layoutAttribute)) { return 'layout'; }
    }
    return null;
  }

  function ownershipLabel(el, owner) {
    return el.tagName.toLowerCase() + (typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : '') + (el.textContent.trim() ? ' "' + el.textContent.trim().slice(0, 40) + '"' : '') + ` (${owner ?? 'no owner'})`;
  }
}
