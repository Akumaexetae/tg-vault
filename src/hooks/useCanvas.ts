import { useCallback, useEffect, useRef, useState } from 'react';
import type { RealtimeChannel } from '@supabase/supabase-js';
import { fetchCanvasObjects, fetchCanvases } from '../lib/queries';
import { getClient } from '../lib/supabase';
import type { Canvas, CanvasObject, User } from '../lib/types';

export interface Cursor {
  who: User;
  x: number;
  y: number;
  at: number;
}

const CURSOR_STALE_MS = 5000;

/**
 * Canvas data and presence.
 *
 * Objects sync through Postgres rows like everything else. Cursors do NOT —
 * a pointer moves dozens of times a second and writing that to the database
 * would burn row limits for data nobody wants persisted. They go over a
 * broadcast channel instead: ephemeral, never stored.
 */
export function useCanvas(canvasId: string | null, user: User) {
  const [canvases, setCanvases] = useState<Canvas[]>([]);
  const [objects, setObjects] = useState<CanvasObject[]>([]);
  const [cursors, setCursors] = useState<Record<string, Cursor>>({});
  const [loading, setLoading] = useState(true);
  const channelRef = useRef<RealtimeChannel | null>(null);

  const reloadCanvases = useCallback(async () => {
    setCanvases(await fetchCanvases());
  }, []);

  const reloadObjects = useCallback(async () => {
    if (!canvasId) {
      setObjects([]);
      setLoading(false);
      return;
    }
    try {
      setObjects(await fetchCanvasObjects(canvasId));
    } finally {
      setLoading(false);
    }
  }, [canvasId]);

  useEffect(() => {
    reloadCanvases().catch(() => {});
  }, [reloadCanvases]);

  useEffect(() => {
    setLoading(true);
    reloadObjects().catch(() => setLoading(false));
    if (!canvasId) return;

    const channel = getClient()
      .channel(`canvas-${canvasId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'canvas_objects' },
        () => {
          reloadObjects().catch(() => {});
        },
      )
      .on('broadcast', { event: 'cursor' }, ({ payload }) => {
        const c = payload as Cursor;
        if (c.who === user) return;
        setCursors((prev) => ({ ...prev, [c.who]: { ...c, at: Date.now() } }));
      })
      .subscribe();

    channelRef.current = channel;

    // Drop cursors that stopped reporting, so a closed window doesn't leave a
    // ghost pointer sitting on the board.
    const sweep = setInterval(() => {
      setCursors((prev) => {
        const now = Date.now();
        const next = Object.fromEntries(
          Object.entries(prev).filter(([, c]) => now - c.at < CURSOR_STALE_MS),
        );
        return Object.keys(next).length === Object.keys(prev).length ? prev : next;
      });
    }, 2000);

    return () => {
      getClient().removeChannel(channel);
      channelRef.current = null;
      clearInterval(sweep);
      setCursors({});
    };
  }, [canvasId, reloadObjects, user]);

  const sendCursor = useCallback(
    (x: number, y: number) => {
      channelRef.current?.send({
        type: 'broadcast',
        event: 'cursor',
        payload: { who: user, x, y, at: Date.now() },
      });
    },
    [user],
  );

  /** Optimistic local edit, so dragging feels instant before the row lands. */
  const patchLocal = useCallback((id: string, patch: Partial<CanvasObject>) => {
    setObjects((prev) => prev.map((o) => (o.id === id ? { ...o, ...patch } : o)));
  }, []);

  return {
    canvases,
    objects,
    cursors,
    loading,
    reloadCanvases,
    reloadObjects,
    sendCursor,
    patchLocal,
  };
}
