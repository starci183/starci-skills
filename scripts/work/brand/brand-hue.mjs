/** A readable name for an OKLCH hue, so a finding says "blue" and not "259 degrees". */
export function hueName(h) {
  const x = ((h % 360) + 360) % 360;
  if (x < 12 || x >= 345) return 'pink-red';
  if (x < 45) return 'red';
  if (x < 70) return 'orange';
  if (x < 110) return 'amber-yellow';
  if (x < 135) return 'lime';
  if (x < 175) return 'green';
  if (x < 225) return 'teal-cyan';
  if (x < 275) return 'blue';
  if (x < 305) return 'violet';
  return 'purple-magenta';
}
