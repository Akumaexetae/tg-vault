import { useEffect, useRef, useState } from 'react';
import { useCanvas } from '../../hooks/useCanvas';
import {
  NOTE_COLORS,
  fitToObjects,
  nextZ,
  objectAt,
  screenToWorld,
  worldToScreen,
  zoomAt,
  type Viewport,
} from '../../lib/canvas';
import {
  createCanvas,
  createObject,
  deleteCanvas,
  deleteObject,
  updateObject,
} from '../../lib/queries';
import type { CanvasObject, CanvasObjectKind, User } from '../../lib/types';

interface Props {
  user: User;
  readOnly: boolean;
  onToast: (message: string, kind?: 'ok' | 'error') => void;
}

type Drag =
  | { mode: 'pan'; startX: number; startY: number; origin: Viewport }
  | { mode: 'move'; id: string; dx: number; dy: number }
  | { mode: 'resize'; id: string; startW: number; startH: number; startX: number; startY: number }
  | { mode: 'arrow'; id: string }
  | null;

const DEFAULTS: Record<CanvasObjectKind, { w: number; h: number; color: string }> = {
  note: { w: 180, h: 130, color: NOTE_COLORS[0] },
  text: { w: 220, h: 40, color: '#17303d' },
  box: { w: 260, h: 180, color: '#00aff0' },
  arrow: { w: 0, h: 0, color: '#5b7585' },
};

export function CanvasView({ user, readOnly, onToast }: Props) {
  const [canvasId, setCanvasId] = useState<string | null>(null);
  const {
    canvases,
    objects,
    cursors,
    reloadCanvases,
    reloadObjects,
    sendCursor,
    patchLocal,
  } = useCanvas(canvasId, user);

  const surface = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<Viewport>({ x: -400, y: -300, zoom: 1 });
  const [drag, setDrag] = useState<Drag>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const lastCursorSend = useRef(0);

  // Open the first canvas automatically; create one if there are none.
  useEffect(() => {
    if (canvasId || canvases.length === 0) return;
    setCanvasId(canvases[0].id);
  }, [canvases, canvasId]);

  const rect = () => surface.current?.getBoundingClientRect();

  const toWorld = (clientX: number, clientY: number) => {
    const r = rect();
    if (!r) return { x: 0, y: 0 };
    return screenToWorld(clientX - r.left, clientY - r.top, view);
  };

  // --- Object operations -----------------------------------------------
  const addObject = async (kind: CanvasObjectKind) => {
    if (!canvasId) return;
    const r = rect();
    const centre = r
      ? screenToWorld(r.width / 2, r.height / 2, view)
      : { x: 0, y: 0 };
    const d = DEFAULTS[kind];
    try {
      const created = await createObject(
        {
          canvas_id: canvasId,
          kind,
          x: Math.round(centre.x - d.w / 2),
          y: Math.round(centre.y - d.h / 2),
          w: d.w,
          h: d.h,
          x2: kind === 'arrow' ? Math.round(centre.x + 160) : null,
          y2: kind === 'arrow' ? Math.round(centre.y) : null,
          text: '',
          color: d.color,
          z: nextZ(objects),
        },
        user,
      );
      await reloadObjects();
      if (kind !== 'arrow') setEditing(created.id);
      setSelected(created.id);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Could not add that', 'error');
    }
  };

  const commit = async (id: string, patch: Partial<CanvasObject>) => {
    patchLocal(id, patch);
    try {
      await updateObject(id, patch, user);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Change not saved', 'error');
      await reloadObjects();
    }
  };

  const removeSelected = async () => {
    if (!selected) return;
    const id = selected;
    setSelected(null);
    setEditing(null);
    try {
      await deleteObject(id);
      await reloadObjects();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Delete failed', 'error');
    }
  };

  // --- Pointer handling ------------------------------------------------
  const onPointerDown = (e: React.PointerEvent) => {
    if (editing) return;
    const world = toWorld(e.clientX, e.clientY);
    const hit = objectAt(objects, world.x, world.y);

    if (!hit || readOnly) {
      setSelected(null);
      setDrag({ mode: 'pan', startX: e.clientX, startY: e.clientY, origin: view });
      return;
    }

    setSelected(hit.id);
    if (hit.z !== nextZ(objects) - 1) commit(hit.id, { z: nextZ(objects) });
    setDrag({ mode: 'move', id: hit.id, dx: world.x - hit.x, dy: world.y - hit.y });
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const world = toWorld(e.clientX, e.clientY);

    // Throttle presence to ~20/sec; smoother than that is invisible anyway.
    const now = Date.now();
    if (now - lastCursorSend.current > 50) {
      lastCursorSend.current = now;
      sendCursor(world.x, world.y);
    }

    if (!drag) return;

    if (drag.mode === 'pan') {
      setView({
        ...drag.origin,
        x: drag.origin.x - (e.clientX - drag.startX) / drag.origin.zoom,
        y: drag.origin.y - (e.clientY - drag.startY) / drag.origin.zoom,
      });
    } else if (drag.mode === 'move') {
      patchLocal(drag.id, {
        x: Math.round(world.x - drag.dx),
        y: Math.round(world.y - drag.dy),
      });
    } else if (drag.mode === 'resize') {
      patchLocal(drag.id, {
        w: Math.max(60, Math.round(drag.startW + (world.x - drag.startX))),
        h: Math.max(40, Math.round(drag.startH + (world.y - drag.startY))),
      });
    } else if (drag.mode === 'arrow') {
      patchLocal(drag.id, { x2: Math.round(world.x), y2: Math.round(world.y) });
    }
  };

  const onPointerUp = async () => {
    if (!drag || drag.mode === 'pan') {
      setDrag(null);
      return;
    }
    const object = objects.find((o) => o.id === drag.id);
    setDrag(null);
    if (!object) return;
    // Persist whatever the optimistic local state settled on.
    if (drag.mode === 'move') await commit(object.id, { x: object.x, y: object.y });
    if (drag.mode === 'resize') await commit(object.id, { w: object.w, h: object.h });
    if (drag.mode === 'arrow') await commit(object.id, { x2: object.x2, y2: object.y2 });
  };

  const onWheel = (e: React.WheelEvent) => {
    const r = rect();
    if (!r) return;
    setView((v) =>
      zoomAt(v, e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? 1.12 : 1 / 1.12),
    );
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (editing) return;
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected && !readOnly) {
        e.preventDefault();
        removeSelected();
      }
      if (e.key === 'Escape') setSelected(null);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const zoomToFit = () => {
    const r = rect();
    if (r) setView(fitToObjects(objects, r.width, r.height));
  };

  const newCanvas = async () => {
    const name = `Board ${canvases.length + 1}`;
    try {
      const created = await createCanvas(name, user);
      await reloadCanvases();
      setCanvasId(created.id);
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Could not create board', 'error');
    }
  };

  const removeCanvas = async () => {
    const current = canvases.find((c) => c.id === canvasId);
    if (!current) return;
    try {
      await deleteCanvas(current.id, user, current.name);
      setCanvasId(null);
      await reloadCanvases();
    } catch (e) {
      onToast(e instanceof Error ? e.message : 'Could not delete board', 'error');
    }
  };

  const selectedObject = objects.find((o) => o.id === selected) ?? null;

  return (
    <div className="canvas-wrap">
      <div className="canvas-toolbar">
        <select
          className="input input-small"
          value={canvasId ?? ''}
          onChange={(e) => setCanvasId(e.target.value || null)}
        >
          {canvases.length === 0 && <option value="">No boards yet</option>}
          {canvases.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <button className="btn btn-tiny" disabled={readOnly} onClick={newCanvas}>
          + Board
        </button>

        <span className="canvas-divider" />

        <button className="btn btn-tiny" disabled={readOnly || !canvasId} onClick={() => addObject('note')}>
          Note
        </button>
        <button className="btn btn-tiny" disabled={readOnly || !canvasId} onClick={() => addObject('text')}>
          Text
        </button>
        <button className="btn btn-tiny" disabled={readOnly || !canvasId} onClick={() => addObject('box')}>
          Box
        </button>
        <button className="btn btn-tiny" disabled={readOnly || !canvasId} onClick={() => addObject('arrow')}>
          Arrow
        </button>

        <span className="canvas-divider" />

        {selectedObject && selectedObject.kind !== 'arrow' && (
          <span className="canvas-colors">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                className={`canvas-swatch ${selectedObject.color === c ? 'canvas-swatch-on' : ''}`}
                style={{ background: c }}
                title="Colour"
                onClick={() => commit(selectedObject.id, { color: c })}
              />
            ))}
          </span>
        )}
        {selectedObject && (
          <button className="btn btn-tiny btn-danger" onClick={removeSelected}>
            Delete
          </button>
        )}

        <span className="canvas-toolbar-right">
          {Object.values(cursors).map((c) => (
            <span key={c.who} className={`activity-avatar avatar-${c.who.toLowerCase()} canvas-who`}>
              {c.who[0]}
            </span>
          ))}
          <button className="btn btn-tiny" onClick={zoomToFit}>
            Fit
          </button>
          <span className="canvas-zoom">{Math.round(view.zoom * 100)}%</span>
          {canvasId && (
            <button className="btn btn-tiny" disabled={readOnly} onClick={removeCanvas}>
              Delete board
            </button>
          )}
        </span>
      </div>

      <div
        ref={surface}
        className={`canvas-surface ${drag?.mode === 'pan' ? 'canvas-panning' : ''}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
        onWheel={onWheel}
        style={{
          backgroundSize: `${24 * view.zoom}px ${24 * view.zoom}px`,
          backgroundPosition: `${-view.x * view.zoom}px ${-view.y * view.zoom}px`,
        }}
      >
        {canvases.length === 0 && (
          <div className="canvas-empty">
            <p>No boards yet.</p>
            <button className="btn btn-primary" disabled={readOnly} onClick={newCanvas}>
              Create one
            </button>
          </div>
        )}

        {objects.map((o) => {
          const p = worldToScreen(o.x, o.y, view);
          const isSelected = o.id === selected;

          if (o.kind === 'arrow') {
            const end = worldToScreen(o.x2 ?? o.x, o.y2 ?? o.y, view);
            return (
              <svg key={o.id} className="canvas-arrow" aria-hidden="true">
                <defs>
                  <marker
                    id={`head-${o.id}`}
                    markerWidth="9"
                    markerHeight="9"
                    refX="8"
                    refY="4.5"
                    orient="auto"
                  >
                    <path d="M0,0 L9,4.5 L0,9 z" fill={o.color} />
                  </marker>
                </defs>
                <line
                  x1={p.x}
                  y1={p.y}
                  x2={end.x}
                  y2={end.y}
                  stroke={o.color}
                  strokeWidth={isSelected ? 3 : 2}
                  markerEnd={`url(#head-${o.id})`}
                />
                {isSelected && !readOnly && (
                  <circle
                    className="canvas-arrow-handle"
                    cx={end.x}
                    cy={end.y}
                    r="6"
                    onPointerDown={(e) => {
                      e.stopPropagation();
                      setDrag({ mode: 'arrow', id: o.id });
                    }}
                  />
                )}
              </svg>
            );
          }

          return (
            <div
              key={o.id}
              className={`canvas-object canvas-${o.kind} ${isSelected ? 'canvas-selected' : ''}`}
              style={{
                left: p.x,
                top: p.y,
                width: o.w * view.zoom,
                height: o.h * view.zoom,
                background: o.kind === 'note' ? o.color : undefined,
                borderColor: o.kind === 'box' ? o.color : undefined,
                color: o.kind === 'text' ? o.color : undefined,
                fontSize: `${(o.kind === 'text' ? 18 : 13) * view.zoom}px`,
              }}
              onDoubleClick={() => !readOnly && setEditing(o.id)}
            >
              {editing === o.id ? (
                <textarea
                  className="canvas-text-input"
                  defaultValue={o.text}
                  autoFocus
                  onBlur={(e) => {
                    setEditing(null);
                    if (e.target.value !== o.text) commit(o.id, { text: e.target.value });
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Escape') (e.target as HTMLTextAreaElement).blur();
                  }}
                />
              ) : (
                <span className="canvas-object-text">
                  {o.text || <em className="canvas-placeholder">Double-click to write</em>}
                </span>
              )}

              {isSelected && !readOnly && (
                <span
                  className="canvas-resize"
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    const world = toWorld(e.clientX, e.clientY);
                    setDrag({
                      mode: 'resize',
                      id: o.id,
                      startW: o.w,
                      startH: o.h,
                      startX: world.x,
                      startY: world.y,
                    });
                  }}
                />
              )}
            </div>
          );
        })}

        {Object.values(cursors).map((c) => {
          const p = worldToScreen(c.x, c.y, view);
          return (
            <div key={c.who} className="canvas-cursor" style={{ left: p.x, top: p.y }}>
              <svg width="16" height="16" viewBox="0 0 16 16">
                <path
                  d="M1 1 L1 12 L4.5 9 L7 14 L9.5 13 L7 8 L11.5 8 z"
                  fill={c.who === 'Tyler' ? '#00aff0' : '#8e44ad'}
                  stroke="#fff"
                  strokeWidth="1"
                />
              </svg>
              <span
                className="canvas-cursor-name"
                style={{ background: c.who === 'Tyler' ? '#00aff0' : '#8e44ad' }}
              >
                {c.who}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
