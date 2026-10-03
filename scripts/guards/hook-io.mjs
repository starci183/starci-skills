/** Read one hook payload without pulling heavier guard dependencies into the in-process fast path. */
export const readInput = (stream) => new Promise((resolve, reject) => {
  let input = '';
  stream.setEncoding('utf8');
  stream.on('data', (chunk) => { input += chunk; });
  stream.on('end', () => resolve(input));
  stream.on('error', reject);
});
