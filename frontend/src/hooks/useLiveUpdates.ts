import { useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { API_BASE_URL } from '@/src/lib/api';
import { useAuth } from '@/src/contexts/AuthContext';

export type LiveConnectionState = 'idle' | 'connecting' | 'connected' | 'reconnecting' | 'unavailable';

/**
 * Connects to GET /api/events via fetch streaming with Authorization header.
 * Handles chunk-split SSE frames, capped backoff reconnection, and aborts on logout/unmount.
 */
export function useLiveUpdates(): LiveConnectionState {
  const { token, isAuthenticated, user } = useAuth();
  const queryClient = useQueryClient();
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('idle');
  const retryAttemptRef = useRef(0);

  useEffect(() => {
    if (!isAuthenticated || !token) {
      setConnectionState('idle');
      return;
    }

    let aborted = false;
    let activeController: AbortController | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const invalidateAffectedQueries = (payload?: Record<string, unknown>) => {
      const batchId =
        typeof payload?.batchId === 'string'
          ? payload.batchId
          : typeof payload?.id === 'string'
            ? payload.id
            : undefined;

      queryClient.invalidateQueries({ queryKey: ['batches'] });
      queryClient.invalidateQueries({ queryKey: ['inbox'] });
      queryClient.invalidateQueries({ queryKey: ['state-dashboard'] });
      queryClient.invalidateQueries({ queryKey: ['state-escalations'] });
      queryClient.invalidateQueries({ queryKey: ['state-jobs'] });

      if (batchId) {
        queryClient.invalidateQueries({ queryKey: ['batch', batchId] });
        queryClient.invalidateQueries({ queryKey: ['batch-history', batchId] });
        queryClient.invalidateQueries({ queryKey: ['batch-revisions', batchId] });
        queryClient.invalidateQueries({ queryKey: ['batch-certificates', batchId] });
        queryClient.invalidateQueries({ queryKey: ['batch-deliveries', batchId] });
      } else {
        queryClient.invalidateQueries({ queryKey: ['batch'] });
        queryClient.invalidateQueries({ queryKey: ['batch-certificates'] });
        queryClient.invalidateQueries({ queryKey: ['batch-deliveries'] });
      }

      if (typeof payload?.certificateId === 'string') {
        queryClient.invalidateQueries({ queryKey: ['certificate', payload.certificateId] });
      }
    };

    const dispatchSseEvent = (eventType: string, rawData: string) => {
      let parsed: Record<string, unknown> | undefined;
      if (rawData) {
        try {
          parsed = JSON.parse(rawData) as Record<string, unknown>;
        } catch {
          parsed = undefined;
        }
      }

      if (eventType === 'ready' || eventType === 'reconnect') {
        invalidateAffectedQueries();
        return;
      }

      if (eventType === 'change' || eventType === 'message') {
        invalidateAffectedQueries(parsed);
      }
    };

    const processBuffer = (buffer: string): string => {
      // Split complete SSE frames separated by blank lines (\n\n or \r\n\r\n)
      const frames = buffer.split(/\r?\n\r?\n/);
      const remainder = frames.pop() ?? '';

      for (const frame of frames) {
        if (!frame.trim()) continue;
        const lines = frame.split(/\r?\n/);
        let eventName = 'message';
        const dataLines: string[] = [];

        for (const line of lines) {
          if (line.startsWith(':')) continue; // SSE comment/heartbeat
          const colonIdx = line.indexOf(':');
          const field = colonIdx === -1 ? line : line.slice(0, colonIdx);
          let value = colonIdx === -1 ? '' : line.slice(colonIdx + 1);
          if (value.startsWith(' ')) value = value.slice(1);

          if (field === 'event') {
            eventName = value || 'message';
          } else if (field === 'data') {
            dataLines.push(value);
          }
        }

        if (dataLines.length > 0 || eventName !== 'message') {
          dispatchSseEvent(eventName, dataLines.join('\n'));
        }
      }

      return remainder;
    };

    const scheduleReconnect = () => {
      if (aborted) return;
      retryAttemptRef.current += 1;
      const delayMs = Math.min(30000, 1500 * Math.pow(2, Math.min(retryAttemptRef.current - 1, 4)));
      setConnectionState('reconnecting');
      reconnectTimer = setTimeout(() => {
        if (!aborted) {
          void connect();
        }
      }, delayMs);
    };

    const connect = async () => {
      if (aborted) return;
      activeController = new AbortController();
      setConnectionState(retryAttemptRef.current > 0 ? 'reconnecting' : 'connecting');

      try {
        const response = await fetch(`${API_BASE_URL}/api/events`, {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'text/event-stream',
          },
          signal: activeController.signal,
        });

        if (response.status === 401 || response.status === 403) {
          setConnectionState('unavailable');
          return;
        }

        if (!response.ok || !response.body) {
          setConnectionState('unavailable');
          scheduleReconnect();
          return;
        }

        retryAttemptRef.current = 0;
        setConnectionState('connected');

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        while (!aborted) {
          const { value, done } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = processBuffer(buffer);
        }

        if (!aborted) {
          scheduleReconnect();
        }
      } catch (err) {
        if (aborted) return;
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setConnectionState('unavailable');
        scheduleReconnect();
      }
    };

    void connect();

    return () => {
      aborted = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (activeController) activeController.abort();
    };
  }, [isAuthenticated, token, user?.id, queryClient]);

  return connectionState;
}
