const minute = 60_000;

export function createRateLimit({ clock = Date.now } = {}) {
  const clients = new Map();
  return function permit(request, { blob = false } = {}) {
    const address = request.headers['cf-connecting-ip'] || request.socket.remoteAddress || 'unknown';
    const key = String(Array.isArray(address) ? address[0] : address).slice(0, 128);
    const now = clock();
    let entry = clients.get(key);
    if (!entry || now - entry.at >= minute) { entry = { at: now, all: 0, blobs: 0 }; clients.set(key, entry); }
    if (entry.all >= 120 || (blob && entry.blobs >= 20)) return false;
    entry.all++;
    if (blob) entry.blobs++;
    if (clients.size > 2048) for (const [id, value] of clients) if (now - value.at >= minute) clients.delete(id);
    return true;
  };
}
