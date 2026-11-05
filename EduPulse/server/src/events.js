// Server-Sent Events hub: pushes lightweight "something changed" signals; clients refetch through the scoped REST API,
// so no private data ever travels over the event stream.
const clients = new Map(); // userId -> Set(res)

export function subscribe(userId, res) {
  if (!clients.has(userId)) clients.set(userId, new Set());
  clients.get(userId).add(res);
  res.on('close', () => { clients.get(userId)?.delete(res); if (!clients.get(userId)?.size) clients.delete(userId); });
}
export function emitAll(topic = '*', meta = {}) {
  const msg = `event: change\ndata: ${JSON.stringify({ topic, ...meta, at: Date.now() })}\n\n`;
  for (const set of clients.values()) for (const res of set) res.write(msg);
}
export const connectedCount = () => [...clients.values()].reduce((a, s) => a + s.size, 0);

export function eventsHandler(req, res) {
  res.set({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache, no-transform', Connection: 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.flushHeaders?.();
  res.write('retry: 3000\n\n: connected\n\n');
  subscribe(req.user.id, res);
  const ka = setInterval(() => res.write(': ping\n\n'), 25000);
  res.on('close', () => clearInterval(ka));
}

// After any successful data-changing request, tell every open dashboard to refresh.
export function liveBroadcast(req, res, next) {
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) return next();
  const p = req.originalUrl;
  if (p.startsWith('/api/auth') || (p.startsWith('/api/notifications') && !p.includes('/announce'))) return next();
  res.on('finish', () => { if (res.statusCode < 400) emitAll('*', { path: p.split('?')[0], by: req.user?.id }); });
  next();
}
