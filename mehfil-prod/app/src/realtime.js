// WebSocket connection to the server with automatic reconnect.
import { WS_URL, freshAccess, session } from './api';

export function connectRealtime(onEvent, onStatus) {
  let ws = null;
  let stopped = false;
  let delay = 1000;
  let timer = null;
  let ping = null;
  let tokenUsed = null;

  const open = async () => {
    if (stopped) return;
    try { tokenUsed = await freshAccess(); } catch { timer = setTimeout(open, delay); delay = Math.min(delay * 2, 30000); return; }
    if (stopped) return;
    ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(tokenUsed)}`);
    onStatus?.('connecting');
    ws.onopen = () => {
      delay = 1000;
      onStatus?.('online');
      ping = setInterval(() => { try { ws.send('ping'); } catch { /* ignore */ } }, 25000);
    };
    ws.onmessage = (m) => {
      try { const evt = JSON.parse(m.data); if (evt.type !== 'pong') onEvent(evt); } catch { /* ignore */ }
    };
    ws.onclose = () => {
      clearInterval(ping);
      onStatus?.('offline');
      if (!stopped) timer = setTimeout(open, delay);
      delay = Math.min(delay * 2, 30000);
    };
    ws.onerror = () => { try { ws.close(); } catch { /* ignore */ } };
  };

  // Reconnect with the new token whenever the user signs in or out.
  const off = session.onChange(() => {
    if (session.access && session.access !== tokenUsed) { try { ws?.close(); } catch { /* ignore */ } clearTimeout(timer); delay = 500; timer = setTimeout(open, 50); }
  });
  open();
  return () => { stopped = true; off(); clearTimeout(timer); clearInterval(ping); try { ws?.close(); } catch { /* ignore */ } };
}
