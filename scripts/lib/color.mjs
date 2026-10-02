// color.mjs — RGBA tuple helpers ([r, g, b, a]) shared by the render checks.

/** `top` alpha-composited over `under` (source-over); the result is opaque (a = 1). */
export const alphaOver = (top, under) => {
  const a = top[3];
  return [0, 1, 2].map((k) => Math.round(top[k] * a + under[k] * (1 - a))).concat([1]);
};
