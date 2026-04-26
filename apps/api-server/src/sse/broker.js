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

/** 세션 종료/삭제 시 연결된 SSE 를 모두 끊고 맵에서 제거 */
export function closeSessionStream(sessionId) {
  const set = clients.get(sessionId);
  if (!set) return;
  for (const res of set) {
    try {
      res.end();
    } catch {
      // ignore
    }
  }
  clients.delete(sessionId);
}
