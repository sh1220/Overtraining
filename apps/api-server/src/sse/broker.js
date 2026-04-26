// 세션별 SSE 클라이언트 관리
const clients = new Map(); // sessionId → Set<res>

export function addClient(sessionId, res) {
  if (!clients.has(sessionId)) clients.set(sessionId, new Set());
  clients.get(sessionId).add(res);
  res.on('close', () => {
    clients.get(sessionId)?.delete(res);
    if (clients.get(sessionId)?.size === 0) clients.delete(sessionId);
  });
}

export function broadcast(sessionId, event, data) {
  const set = clients.get(sessionId);
  if (!set) return;
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of set) {
    res.write(msg);
  }
}

export function getActiveSessionIds() {
  return [...clients.keys()];
}
